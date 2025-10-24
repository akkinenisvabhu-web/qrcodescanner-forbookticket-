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
  const [isAuthReady, setIsAuthReady] = useState(false);

  const html5QrCodeRef = useRef(null);
  const isScannerScriptLoaded = useScript("https://unpkg.com/html5-qrcode");

  // ---------------- Auth ----------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthReady(true);
      } else {
        try {
          await signInAnonymously(auth);
        } catch {
          setStatus("error");
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
      return;
    }

    const qrCodeScanner = new window.Html5Qrcode("qr-reader");
    html5QrCodeRef.current = qrCodeScanner;

    const onScanSuccess = (decodedText) => {
      stopScanner();
      setStatus("loading");
      verifyTicket(decodedText);
    };

    const onScanFailure = () => {};

    qrCodeScanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        onScanFailure
      )
      .catch(() => setStatus("error"));

    return () => stopScanner();
  }, [status, isScannerScriptLoaded, isAuthReady]);

  const stopScanner = () => {
    const scanner = html5QrCodeRef.current;
    if (scanner && scanner.stop) {
      scanner.stop().finally(() => {});
      html5QrCodeRef.current = null;
    } else {
      html5QrCodeRef.current = null;
    }
  };

  // ---------------- Verify Ticket ----------------
  const verifyTicket = async (ticketQRData) => {
    let ticketId = ticketQRData;
    let qrInfo = {};

    // Parse JSON if QR contains JSON
    try {
      qrInfo = JSON.parse(ticketQRData);
      ticketId = qrInfo.id;
    } catch {}

    setParsedTicketId(ticketId);

    const docRef = doc(db, "tickets", ticketId);
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTicketData(docSnap.data());
        setStatus("confirmed");
      } else {
        // Display QR JSON even if not in Firestore
        setTicketData({ ...qrInfo, id: ticketId });
        setStatus("notfound");
      }
    } catch {
      setStatus("error");
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

            {ticketData && (
              <div className="w-full p-4 mt-2 space-y-2 bg-gray-700 rounded-lg text-left">
                {ticketData.name && (
                  <div>
                    <span className="font-semibold">Name:</span> {ticketData.name}
                  </div>
                )}
                {ticketData.rollno && (
                  <div>
                    <span className="font-semibold">Roll Number:</span> {ticketData.rollno}
                  </div>
                )}
                {ticketData.show && (
                  <div>
                    <span className="font-semibold">Show:</span> {ticketData.show}
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
    </div>
  );
}
