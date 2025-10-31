import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  limit,
  setLogLevel,
} from 'firebase/firestore';
import { Search, CheckCircle, XCircle, Loader2 } from 'lucide-react';

// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyDJW77QWT9ioNKgnuyUGqfml9HXaQmhKmE",
  authDomain: "ticket-booking-app-e9607.firebaseapp.com",
  projectId: "ticket-booking-app-e9607",
  storageBucket: "ticket-booking-app-e9607.firebasestorage.app",
  messagingSenderId: "480956494147",
  appId: "1:480956494147:web:9f088a2decf7d440dbbff6",
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

setLogLevel('error'); // optional: reduce console noise

export default function App() {
  const [rollNo, setRollNo] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | confirmed | notfound | error
  const [ticketData, setTicketData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAuthReady, setIsAuthReady] = useState(false);

  // --- Firebase Auth Effect ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthReady(true);
      } else {
        try {
          await signInAnonymously(auth);
          setIsAuthReady(true);
        } catch (error) {
          console.error("Error signing in anonymously:", error);
          setErrorMessage("Authentication failed.");
          setStatus('error');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Firestore Ticket Verification ---
  const handleSubmitSearch = async (e) => {
    e.preventDefault();
    if (!rollNo.trim() || !isAuthReady) {
      setErrorMessage("Please wait for connection or enter a valid Roll No.");
      setStatus('error');
      return;
    }

    setStatus('loading');
    setTicketData(null);
    setErrorMessage('');

    try {
      const ticketsRef = collection(db, 'tickets');
      const q = query(ticketsRef, where('userRollNo', '==', rollNo.trim()), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setStatus('notfound');
        setTicketData(null);
      } else {
        const docData = querySnapshot.docs[0].data();
        console.log("Ticket data:", docData);
        setTicketData(docData);
        setStatus('confirmed');
      }
    } catch (error) {
      console.error("Error getting document:", error);
      setStatus('error');
      setErrorMessage('Error querying Firestore. Check your connection or rules.');
    }
  };

  const handleSearchAgain = () => {
    setStatus('idle');
    setTicketData(null);
    setRollNo('');
    setErrorMessage('');
  };

  // --- Render Status ---
  const renderStatusMessage = () => {
    switch (status) {
      case 'confirmed':
        return (
          <div className="text-center text-green-400">
            <CheckCircle className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Ticket Found</h2>
          </div>
        );
      case 'notfound':
        return (
          <div className="text-center text-red-400">
            <XCircle className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Ticket Not Found</h2>
            <p className="text-lg">No ticket found with Roll No: {rollNo}</p>
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
            <h2 className="text-2xl font-bold">Searching...</h2>
          </div>
        );
      default:
        return null;
    }
  };

  // --- Render Ticket Data ---
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
          <span className="font-medium text-white">{ticketData.userRollNo}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-400">Show:</span>
          <span className="font-medium text-white">{ticketData.showName}</span>
        </div>
      </div>
    );
  };

  // --- UI ---
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-900 font-sans">
      <div className="w-full max-w-md p-6 text-center text-white bg-gray-800 rounded-lg shadow-2xl">
        <h1 className="text-3xl font-bold mb-6 text-blue-400">Ticket Verifier</h1>

        <div className="w-full p-4 bg-gray-700 rounded-lg min-h-[300px] flex items-center justify-center">
          {status === 'idle' && (
            <form className="w-full" onSubmit={handleSubmitSearch}>
              <label htmlFor="rollNoInput" className="block text-lg font-medium mb-3">
                Enter Roll Number
              </label>
              <input
                id="rollNoInput"
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="e.g., 2520030199"
                className="w-full px-4 py-3 text-lg text-white bg-gray-800 border-2 border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!isAuthReady || !rollNo.trim()}
                className="flex items-center justify-center w-full px-6 py-3 mt-6 font-semibold text-white transition-all bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
              >
                <Search className="w-5 h-5 mr-2" />
                Search Ticket
              </button>
              {!isAuthReady && (
                <p className="text-yellow-400 text-sm mt-4">Connecting to database...</p>
              )}
            </form>
          )}

          {(status === 'confirmed' ||
            status === 'notfound' ||
            status === 'error' ||
            status === 'loading') && (
            <div className="flex flex-col items-center justify-center w-full">
              {renderStatusMessage()}
              {renderTicketData()}
              <button
                onClick={handleSearchAgain}
                className="flex items-center justify-center w-full px-6 py-3 mt-6 font-semibold text-white transition-all bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                <Search className="w-5 h-5 mr-2" />
                Search Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
