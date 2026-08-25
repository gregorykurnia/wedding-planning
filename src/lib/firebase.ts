import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  inMemoryPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * True only when all required Firebase env vars are present and look like
 * real values (not empty strings / left-over placeholders). We deliberately
 * avoid throwing at import time so the app can build & render without a
 * configured Firebase project (e.g. during initial scaffolding or CI).
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    // Explicit fallback chain: if IndexedDB is unavailable or gets torn down
    // mid-operation (the "Database is closing/hidden" error seen on Safari /
    // private browsing / backgrounded tabs during redirect sign-in), Auth
    // falls back to localStorage, then sessionStorage, then in-memory —
    // instead of throwing and leaving the user stuck.
    try {
      auth = initializeAuth(app, {
        persistence: [
          indexedDBLocalPersistence,
          browserLocalPersistence,
          browserSessionPersistence,
          inMemoryPersistence,
        ],
      });
    } catch {
      // Already initialized on this FirebaseApp instance (e.g. dev-mode
      // fast refresh re-running this module) — reuse the existing instance.
      auth = getAuth(app);
    }
    db = getFirestore(app);
  } catch (err) {
    // Never let a bad/partial config crash the app at import time.
    console.error("Failed to initialize Firebase:", err);
    app = null;
    auth = null;
    db = null;
  }
}

export { app, auth, db };
