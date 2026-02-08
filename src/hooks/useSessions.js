import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase.js";

const mapSession = (doc) => {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
  };
};

export const useSessions = (userId) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) {
      setSessions([]);
      setLoading(false);
      return undefined;
    }
    if (!firebaseConfigured || !db) {
      setSessions([]);
      setLoading(false);
      setError(
        "Firebase is not configured. Add VITE_FIREBASE_* values to .env and restart."
      );
      return undefined;
    }

    const sessionsRef = collection(db, "users", userId, "sessions");
    const sessionsQuery = query(sessionsRef, orderBy("timeIn", "desc"));
    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        setSessions(snapshot.docs.map(mapSession));
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to load sessions.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { sessions, loading, error };
};

