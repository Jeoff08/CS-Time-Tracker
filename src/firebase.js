
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC77YxzUDPZrx0Ye5x49klwKQgmy9O1MEQ",
  authDomain: "time-tracker-e2af9.firebaseapp.com",
  projectId: "time-tracker-e2af9",
  storageBucket: "time-tracker-e2af9.firebasestorage.app",
  messagingSenderId: "658981987513",
  appId: "1:658981987513:web:b6c48834490c3d2788e768",
  measurementId: "G-XWHMB9NLN1"
};

// Initialize Firebase
export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const app = initializeApp(firebaseConfig);
getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);