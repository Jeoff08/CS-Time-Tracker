import { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth, firebaseConfigured } from "../firebase.js";
import { seedInitialSessions } from "../services/seedSessions.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setUser(null);
      setLoading(false);
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        await seedInitialSessions(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const signUp = (email, password) => {
    if (!firebaseConfigured || !auth) {
      throw new Error(
        "Firebase is not configured. Add VITE_FIREBASE_* values to .env and restart the dev server."
      );
    }
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const signIn = (email, password) => {
    if (!firebaseConfigured || !auth) {
      throw new Error(
        "Firebase is not configured. Add VITE_FIREBASE_* values to .env and restart the dev server."
      );
    }
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signOutUser = () => {
    if (!firebaseConfigured || !auth) {
      return Promise.resolve();
    }
    return signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUp, signOutUser, firebaseConfigured }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

