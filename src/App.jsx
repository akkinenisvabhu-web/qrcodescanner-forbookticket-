import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collectionGroup, query, where, getDocs, limit, setLogLevel } from 'firebase/firestore';
import { Camera, CheckCircle, XCircle, Loader2 } from 'lucide-react';

// --- PASTE YOUR FIREBASE CONFIG HERE ---
// (You can get this from your Firebase project settings)
// ...
let firebaseConfig;
if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
} else {
  firebaseConfig = {
    apiKey: "AIzaSyDJW77QWT9ioNKgnuyUGqfml9HXaQmhKmE",
    authDomain: "ticket-booking-app-e9607.firebaseapp.com",
    projectId: "ticket-booking-app-e9607",
    storageBucket: "ticket-booking-app-e9607.firebasestorage.app",
    messagingSenderId: "480956494147",
    appId: "1:480956494147:web:9f088a2decf7d440dbbff6"
  };
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable Firestore debug logging
setLogLevel('debug');

// --- Helper: Script Loader ---
function useScript(url) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let script = document.querySelector(`script[src="${url}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => setLoaded(true);
      document.body.appendChild(script);
    } else {
      setLoaded(true);
    }
    // No cleanup needed
  }, [url]);
  return loaded;
}

export default function App() {
  const [status, setStatus] = useState('idle'); // 'idle', 'scanning', 'loading', 'confirmed', 'notfound', 'error'
  const [ticketData, setTicketData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const html5QrCodeRef = useRef(null);
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  // load html5-qrcode (pick a version if you prefer)
  const isScannerScriptLoaded = useScript('https://unpkg.com/html5-qrcode');

  // --- Firebase Auth Effect ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setIsAuthReady(true);
      } else {
        try {
          if (typeof __initial_auth_token !== 'undefined') {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error("Error signing in:", error);
          setErrorMessage("Authentication failed.");
          setStatus('error');
          setIsAuthReady(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // --- QR Code Scanning Effect ---
  useEffect(() => {
    if (status !== 'scanning' || !isScannerScriptLoaded || !isAuthReady) {
      return;
    }

    if (!window.Html5Qrcode) {
      console.error("html5-qrcode library not loaded.");
      setStatus('error');
      setErrorMessage('Scanner library failed to load.');
      return;
    }

    const qrCodeScanner = new window.Html5Qrcode("qr-reader");
    html5QrCodeRef.current = qrCodeScanner;

    const onScanSuccess = (decodedText, decodedResult) => {
      // Stop the scanner
      stopScanner();

      // Handle the result
      console.log(`Scan result: ${decodedText}`, decodedResult);
      setStatus('loading');
      verifyTicket(decodedText);
    };

    const onScanFailure = (error) => {
      // frequent failures are normal (no QR in frame)
      if (typeof error === 'string' && !error.includes("No QR code found")) {
        console.warn(`QR scan error: ${error}`);
      }
    };

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      facingMode: "environment"
    };

    qrCodeScanner.start(
      { facingMode: "environment" },
      config,
      onScanSuccess,
      onScanFailure
    ).catch(err => {
      console.error("Error starting QR scanner:", err);
      // Fallback to any camera if rear fails
      qrCodeScanner.start(
        undefined,
        config,
        onScanSuccess,
        onScanFailure
      ).catch(err2 => {
        console.error("Critical scanner error:", err2);
        setStatus('error');
        setErrorMessage('Could not start camera. Check permissions.');
      });
    });

    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isScannerScriptLoaded, isAuthReady]);

  // --- Stop Scanner Function ---
  const stopScanner = () => {
    const scanner = html5QrCodeRef.current;
    if (scanner && typeof scanner.stop === 'function') {
      scanner.stop()
        .then(() => {
          console.log("QR Scanner stopped.");
        })
        .catch(err => {
          console.error("Error stopping scanner:", err);
        })
        .finally(() => {
          html5QrCodeRef.current = null;
        });
    } else {
      html5QrCodeRef.current = null;
    }
  };

  // --- Firestore Ticket Verification ---
  const verifyTicket = async (ticketIdFromQR) => {
    if (!db || !isAuthReady) {
      setStatus('error');
      setErrorMessage('Database not ready.');
      return;
    }

    // Collection group query to find the ticket across all shows
    const ticketsCollectionGroup = collectionGroup(db, 'tickets');

    const q = query(
      ticketsCollectionGroup,
      where("ticketId", "==", ticketIdFromQR),
      limit(1)
    );

    try {
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        console.log("Ticket data:", docSnap.data());
        setTicketData(docSnap.data());
        setStatus('confirmed');
      } else {
        console.log("No such document!");
        setTicketData(null);
        setStatus('notfound');
      }
    } catch (error) {
      console.error("Error getting document:", error);
      setStatus('error');
      setErrorMessage('Error querying database. Check rules & index.');
    }
  };

  // --- Render helpers ---
  const renderStatusMessage = () => {
    switch (status) {
      case 'confirmed':
        return (
          <div className="text-center text-green-400">
            <CheckCircle className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Confirmed Ticket</h2>
          </div>
        );
      case 'notfound':
        return (
          <div className="text-center text-red-400">
            <XCircle className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Ticket Not Found</h2>
            <p className="text-lg">This QR code is not valid or not booked.</p>
          </div>
        );
      case 'error':
        return (
          <div className="text-center text-red-400">
            <XCircle className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Error</h2>
            <p className="text-lg">{errorMessage || 'An unknown error occurred.'}</p>
          </div>
        );
      case 'loading':
        return (
          <div className="text-center text-blue-400">
            <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold">Verifying...</h2>
          </div>
        );
      default:
        return null;
    }
  };

  const renderTicketData = () => {
    if (status !== 'confirmed' || !ticketData) return null;

    return (
      <div className="w-full p-4 mt-6 space-y-2 text-left bg-gray-700 rounded-lg">
        <div className="flex justify-between">
          <span className="font-semibold text-gray-400">Name:</span>
          <span className="font-medium text-white">{ticketData.userName}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-400">Roll No:</span>
          <span className="font-medium text-white">{ticketData.rollNumber}</span>
        </div>
        {ticketData.showName && (
          <div className="flex justify-between">
            <span className="font-semibold text-gray-400">Show:</span>
            <span className="font-medium text-white">{ticketData.showName}</span>
          </div>
        )}
      </div>
    );
  };

  const handleScanAgain = () => {
    setTicketData(null);
    setErrorMessage('');
    setStatus('scanning');
  };

  const handleStartScanning = () => {
    if (!isScannerScriptLoaded) {
      setErrorMessage('Scanner library is still loading...');
      setStatus('error');
      return;
    }
    if (!isAuthReady) {
      setErrorMessage('Authenticating... Please wait.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
      return;
    }
    setStatus('scanning');
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-900 font-sans">
      <div className="w-full max-w-md p-6 text-center text-white bg-gray-800 rounded-lg shadow-2xl">
        <h1 className="text-3xl font-bold mb-6 text-blue-400">
          Ticket Verifier
        </h1>

        <div className="w-full p-4 bg-gray-700 rounded-lg min-h-[300px] flex items-center justify-center">
          {status === 'idle' && (
            <button
              onClick={handleStartScanning}
              className="flex items-center justify-center px-6 py-3 font-semibold text-white transition-all bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              <Camera className="w-5 h-5 mr-2" />
              Start Scanning
            </button>
          )}

          {status === 'scanning' && (
            <div className="w-full">
              {/* This div will be used by html5-qrcode to render the video feed */}
              <div id="qr-reader" className="w-full rounded-lg overflow-hidden border-2 border-gray-600"></div>
              <button
                onClick={stopScanner}
                className="w-full px-4 py-2 mt-4 font-semibold text-white transition-all bg-gray-600 rounded-lg hover:bg-gray-500"
              >
                Stop
              </button>
            </div>
          )}

          {(status === 'confirmed' || status === 'notfound' || status === 'error' || status === 'loading') && (
            <div className="flex flex-col items-center justify-center w-full">
              {renderStatusMessage()}
              {renderTicketData()}

              {status !== 'loading' && (
                <button
                  onClick={handleScanAgain}
                  className="flex items-center justify-center w-full px-6 py-3 mt-6 font-semibold text-white transition-all bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                >
                  <Camera className="w-5 h-5 mr-2" />
                  Scan Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
