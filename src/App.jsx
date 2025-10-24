import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { Camera, CheckCircle, XCircle, Loader2 } from "lucide-react";

const firebaseConfig = {
  apiKey: "AIzaSyDJW77QWT9ioNKgnuyUGqfml9HXaQmhKmE",
  authDomain: "ticket-booking-app-e9607.firebaseapp.com",
  projectId: "ticket-booking-app-e9607",
  storageBucket: "ticket-booking-app-e9607.firebasestorage.app",
  messagingSenderId: "480956494147",
  appId: "1:480956494147:web:9f088a2decf7d440dbbff6",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function useScript(url) {
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    let script = document.querySelector(`script[src="${url}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = () => setLoaded(true);
      document.body.appendChild(script);
    } else setLoaded(true);
  }, [url]);
  return loaded;
}

export default function App() {
  const [status, setStatus] = useState("idle"); // idle, scanning, loading, confirmed, notfound, error
  const [ticketData, setTicketData] = useState(null);
  const [parsedTicketId, setParsedTicketId] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]); // for on-page debug logs
  const [isAuthReady, setIsAuthReady] = useState(false);

  const html5QrCodeRef = useRef(null);
  const isScannerScriptLoaded = useScript("https://unpkg.com/html5-qrcode");

  // ---------------- Helper to add debug messages ----------------
  const addDebugLog = (message) => {
    setDebugLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // ---------------- Auth ----------------
  useEffect(() => {
    addDebugLog("Initializing Firebase Auth...");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthReady(true);
        addDebugLog(`Authenticated user: ${user.uid}`);
      } else {
        try {
          await signInAnonymously(auth);
          addDebugLog("Signed in anonymously.");
        } catch (error) {
          setStatus("error");
          addDebugLog(`Auth error: ${error.message}`);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // ---------------- QR Scanner ----------------
  useEffect(() => {
    if (status !== "scanning" || !isScannerScriptLoaded || !isAuthReady) return;
    if (!window.Html5Qrcode) {
      setStatus("error");
      addDebugLog("html5-qrcode library not loaded.");
      return;
    }

    addDebugLog("Starting QR scanner...");
    const qrCodeScanner = new window.Html5Qrcode("qr-reader");
    html5QrCodeRef.current = qrCodeScanner;

    const onScanSuccess = (decodedText) => {
      stopScanner();
      addDebugLog(`QR scanned: ${decodedText}`);
      setStatus("loading");
      verifyTicket(decodedText);
    };

    const onScanFailure = (error) => {
      if (error && !error.includes("No QR code found")) {
        addDebugLog(`QR scan error: ${error}`);
      }
    };

    qrCodeScanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        onScanFailure
      )
      .catch((err) => {
        setStatus("error");
        addDebugLog(`Failed to start scanner: ${err.message}`);
      });

    return () => stopScanner();
  }, [status, isScannerScriptLoaded, isAuthReady]);

  const stopScanner = () => {
    const scanner = html5QrCodeRef.current;
    if (scanner && scanner.stop) {
      scanner.stop().finally(() => addDebugLog("QR scanner stopped."));
      html5QrCodeRef.current = null;
    } else {
      html5QrCodeRef.current = null;
    }
  };

  // ---------------- Verify Ticket ----------------
  const verifyTicket = async (ticketIdFromQR) => {
    const ticketId = ticketIdFromQR.split("/").pop();
    setParsedTicketId(ticketId);
    addDebugLog(`Verifying ticket: ${ticketId}`);

    const docRef = doc(db, "tickets", ticketId);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTicketData(docSnap.data());
        setStatus("confirmed");
        addDebugLog("Ticket found and confirmed.");
      } else {
        setTicketData(null);
        setStatus("notfound");
        addDebugLog("No such ticket found.");
      }
    } catch (error) {
      setStatus("error");
      addDebugLog(`Firestore error: ${error.message}`);
    }
  };

  const handleStartScanning = () => setStatus("scanning");
  const handleScanAgain = () => {
    setTicketData(null);
    setParsedTicketId(null);
    setStatus("scanning");
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen p-4 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4 text-blue-400">Ticket Verifier</h1>

      <div className="w-full max-w-md p-4 bg-gray-800 rounded-lg mb-4 min-h-[300px] flex flex-col items-center justify-center">
        {status === "idle" && (
          <button onClick={handleStartScanning} className="bg-blue-600 px-6 py-3 rounded-lg">
            Start Scanning
          </button>
        )}

        {status === "scanning" && (
          <div className="w-full flex flex-col items-center">
            <div id="qr-reader" className="w-full rounded-lg overflow-hidden border-2 border-gray-600 mb-2"></div>
            <button onClick={stopScanner} className="mt-2 bg-gray-600 px-4 py-2 rounded">
              Stop
            </button>
          </div>
        )}

        {(status === "loading" || status === "confirmed" || status === "notfound" || status === "error") && (
          <div className="w-full flex flex-col items-center mt-2">
            {status === "loading" && <Loader2 className="animate-spin w-10 h-10 mb-2" />}
            {status === "confirmed" && <CheckCircle className="w-10 h-10 text-green-400 mb-2" />}
            {(status === "notfound" || status === "error") && <XCircle className="w-10 h-10 text-red-400 mb-2" />}

            {ticketData && status === "confirmed" && (
              <div className="w-full p-4 mt-2 space-y-2 bg-gray-700 rounded-lg text-left">
                <div>
                  <span className="font-semibold">Name:</span> {ticketData.userName}
                </div>
                <div>
                  <span className="font-semibold">Roll Number:</span> {ticketData.rollNumber}
                </div>
                {ticketData.showName && (
                  <div>
                    <span className="font-semibold">Show:</span> {ticketData.showName}
                  </div>
                )}
                <div>
                  <span className="font-semibold">Ticket ID:</span> {parsedTicketId}
                </div>
              </div>
            )}

            <button onClick={handleScanAgain} className="mt-4 bg-blue-600 px-6 py-2 rounded">
              Scan Again
            </button>
          </div>
        )}
      </div>

      {/* ---------------- Debug Logs ---------------- */}
      <div className="w-full max-w-md p-4 bg-gray-700 rounded-lg text-left text-sm overflow-y-auto h-48">
        <h2 className="font-bold text-yellow-400 mb-2">Debug Logs</h2>
        {debugLogs.map((log, idx) => (
          <div key={idx}>{log}</div>
        ))}
      </div>
    </div>
  );
}
