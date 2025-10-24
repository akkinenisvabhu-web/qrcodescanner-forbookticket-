import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore, doc, getDoc, setLogLevel } from "firebase/firestore";
import { Camera, CheckCircle, XCircle, Loader2 } from "lucide-react";

const isBrowser = typeof window !== "undefined";
const runtimeFirebaseConfig =
  isBrowser && window.__firebase_config
    ? JSON.parse(window.__firebase_config)
    : null;

const firebaseConfig = runtimeFirebaseConfig || {
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
setLogLevel("debug");

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
  const [status, setStatus] = useState("idle");
  const [ticketData, setTicketData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const html5QrCodeRef = useRef(null);
  const isScannerScriptLoaded = useScript("https://unpkg.com/html5-qrcode");

  const addLog = (msg) => setLogs((prev) => [...prev, msg]);

  // ---------------- Auth ----------------
  useEffect(() => {
    addLog("[INFO] Initializing Firebase Auth...");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        addLog("[INFO] Authenticated user: " + user.uid);
        setUserId(user.uid);
        setIsAuthReady(true);
      } else {
        try {
          addLog("[INFO] Signing in...");
          const token = isBrowser && window.__initial_auth_token ? window.__initial_auth_token : null;
          if (token) {
            addLog("[INFO] Using custom token...");
            await signInWithCustomToken(auth, token);
          } else {
            addLog("[INFO] Signing in anonymously...");
            await signInAnonymously(auth);
          }
        } catch (error) {
          addLog("[ERROR] Auth failed: " + error.message);
          setStatus("error");
          setIsAuthReady(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // ---------------- QR Scanner ----------------
  useEffect(() => {
    if (status !== "scanning" || !isScannerScriptLoaded || !isAuthReady) return;

    if (!window.Html5Qrcode) {
      addLog("[ERROR] html5-qrcode library not loaded.");
      setStatus("error");
      return;
    }

    addLog("[INFO] Starting QR scanner...");
    const qrCodeScanner = new window.Html5Qrcode("qr-reader");
    html5QrCodeRef.current = qrCodeScanner;

    const onScanSuccess = (decodedText) => {
      addLog("[INFO] QR scanned: " + decodedText);
      stopScanner();
      setStatus("loading");
      verifyTicket(decodedText);
    };

    const onScanFailure = (error) => {
      if (typeof error === "string" && !error.includes("No QR code found")) {
        addLog("[WARN] QR scan error: " + error);
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
        addLog("[ERROR] QR scanner start failed: " + err.message);
        setStatus("error");
      });

    return () => stopScanner();
  }, [status, isScannerScriptLoaded, isAuthReady]);

  const stopScanner = () => {
    const scanner = html5QrCodeRef.current;
    if (scanner && typeof scanner.stop === "function") {
      addLog("[INFO] Stopping QR scanner...");
      scanner
        .stop()
        .then(() => addLog("[INFO] QR scanner stopped"))
        .catch((err) => addLog("[ERROR] Stopping scanner failed: " + err.message))
        .finally(() => (html5QrCodeRef.current = null));
    } else html5QrCodeRef.current = null;
  };

  // ---------------- Verify Ticket ----------------
  const verifyTicket = async (ticketIdFromQR) => {
    addLog("[INFO] Verifying ticket: " + ticketIdFromQR);

    if (!db || !isAuthReady) {
      addLog("[ERROR] Database not ready");
      setStatus("error");
      return;
    }

    // Extract ticket ID from URL
    const ticketId = ticketIdFromQR.split("/").pop();
    addLog("[INFO] Extracted ticket ID: " + ticketId);

    const docRef = doc(db, "tickets", ticketId);

    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        addLog("[INFO] Ticket found: " + JSON.stringify(docSnap.data()));
        setTicketData(docSnap.data());
        setStatus("confirmed");
      } else {
        addLog("[WARN] Ticket not found");
        setTicketData(null);
        setStatus("notfound");
      }
    } catch (error) {
      addLog("[ERROR] Firestore error: " + error.message);
      setStatus("error");
    }
  };

  // ---------------- UI Handlers ----------------
  const handleStartScanning = () => setStatus("scanning");
  const handleScanAgain = () => {
    setTicketData(null);
    setLogs([]);
    setStatus("scanning");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 font-sans text-white">
      <h1 className="text-3xl font-bold mb-4 text-blue-400">Ticket Verifier</h1>

      <div className="w-full max-w-md p-4 bg-gray-800 rounded-lg mb-4 min-h-[300px] flex flex-col items-center justify-center">
        {status === "idle" && (
          <button onClick={handleStartScanning} className="bg-blue-600 px-6 py-3 rounded-lg">
            Start Scanning
          </button>
        )}

        {status === "scanning" && (
          <div className="w-full flex flex-col items-center">
            <div id="qr-reader" className="w-full rounded-lg overflow-hidden border-2 border-gray-600"></div>
            <button onClick={stopScanner} className="mt-2 bg-gray-600 px-4 py-2 rounded">
              Stop
            </button>
          </div>
        )}

        {(status === "loading" || status === "confirmed" || status === "notfound" || status === "error") && (
          <div className="w-full flex flex-col items-center">
            {status === "loading" && <Loader2 className="animate-spin w-10 h-10 mb-2" />}
            {status === "confirmed" && <CheckCircle className="w-10 h-10 text-green-400 mb-2" />}
            {status === "notfound" && <XCircle className="w-10 h-10 text-red-400 mb-2" />}
            <pre className="w-full max-h-60 overflow-auto bg-gray-700 p-2 rounded text-sm mb-2">{JSON.stringify(ticketData, null, 2)}</pre>
            <button onClick={handleScanAgain} className="bg-blue-600 px-6 py-2 rounded">
              Scan Again
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-md p-2 bg-gray-700 rounded-lg h-48 overflow-auto text-sm">
        <h2 className="font-bold mb-1">Debug Logs:</h2>
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}
