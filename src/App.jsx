import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDJW77QWT9ioNKgnuyUGqfml9HXaQmhKmE",
  authDomain: "ticket-booking-app-e9607.firebaseapp.com",
  projectId: "ticket-booking-app-e9607",
  storageBucket: "ticket-booking-app-e9607.firebasestorage.app",
  messagingSenderId: "480956494147",
  appId: "1:480956494147:web:9f088a2decf7d440dbbff6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

await signInAnonymously(auth);

const docRef = doc(db, "tickets", "YOUR_TICKET_ID_HERE");
const docSnap = await getDoc(docRef);

if (docSnap.exists()) {
  console.log("Ticket data:", docSnap.data());
} else {
  console.log("No such document!");
}
