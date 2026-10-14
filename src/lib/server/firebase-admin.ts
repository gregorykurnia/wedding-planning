import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { RequestError } from "./request-error";

/**
 * The Admin SDK for route handlers (plan §2.9). It skips the Firestore rules,
 * so every handler checks the caller with `verifyRequest()` first.
 *
 * - Production: `FIREBASE_SERVICE_ACCOUNT` holds the service account key's
 *   JSON (Firebase console › Project settings › Service accounts).
 * - Emulators: `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST`
 *   are set (the tests do); no credentials are needed.
 */
const APP_NAME = "server";

function projectId(): string | undefined {
  return process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
}

function adminApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId: projectId() }, APP_NAME);
  }
  const key = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!key) throw new RequestError(503, "not-configured", "FIREBASE_SERVICE_ACCOUNT is not set");
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(key);
  } catch {
    throw new RequestError(503, "not-configured", "FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }
  return initializeApp({ credential: cert(parsed), projectId: projectId() ?? parsed.project_id }, APP_NAME);
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}
