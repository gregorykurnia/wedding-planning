"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  getRedirectResult,
  initializeAuth,
  inMemoryPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  type Auth,
  type User,
} from "firebase/auth";
import { initializeApp } from "firebase/app";
import { app, auth, isFirebaseConfigured, firebaseConfig } from "@/lib/firebase";

const isIndexedDbError = (err: unknown) =>
  err instanceof Error && err.message.includes("closing/hidden");

// Lazily-created auth instance that never touches IndexedDB, for browsers
// (e.g. private browsing) where it's unreliable and closes mid-write.
let fallbackAuth: Auth | null = null;
const getFallbackAuth = (): Auth => {
  if (fallbackAuth) return fallbackAuth;
  if (!app) throw new Error("Firebase is not configured.");
  const fallbackApp = initializeApp(firebaseConfig, "auth-fallback");
  fallbackAuth = initializeAuth(fallbackApp, {
    persistence: inMemoryPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  return fallbackAuth;
};

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  redirectError: Error | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [activeAuth, setActiveAuth] = useState<Auth | null>(auth);
  const [redirectError, setRedirectError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !activeAuth) {
      return;
    }
    const unsubscribe = onAuthStateChanged(activeAuth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [activeAuth]);

  // Completes a signInWithRedirect flow after Google sends the browser back.
  useEffect(() => {
    if (!activeAuth) return;
    getRedirectResult(activeAuth).catch((err) => {
      if (isIndexedDbError(err)) {
        setActiveAuth(getFallbackAuth());
        return;
      }
      setRedirectError(err instanceof Error ? err : new Error(String(err)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Runs `fn` against the current auth instance; if IndexedDB is broken
  // (common in private browsing), switches to an in-memory-only instance
  // and retries once.
  const withAuth = async <T,>(fn: (a: Auth) => Promise<T>): Promise<T> => {
    if (!activeAuth) throw new Error("Firebase is not configured.");
    try {
      return await fn(activeAuth);
    } catch (err) {
      if (isIndexedDbError(err)) {
        const fallback = getFallbackAuth();
        setActiveAuth(fallback);
        return await fn(fallback);
      }
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    if (!activeAuth) throw new Error("Firebase is not configured.");
    // Redirect-based flow avoids relying on window.closed/close, which the
    // platform's Cross-Origin-Opener-Policy header blocks for popups.
    await signInWithRedirect(activeAuth, new GoogleAuthProvider());
  };

  const signInWithEmail = async (email: string, password: string) => {
    await withAuth((a) => signInWithEmailAndPassword(a, email, password));
  };

  const registerWithEmail = async (email: string, password: string) => {
    await withAuth((a) => createUserWithEmailAndPassword(a, email, password));
  };

  const signOut = async () => {
    if (!activeAuth) return;
    await firebaseSignOut(activeAuth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isFirebaseConfigured,
        redirectError,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
