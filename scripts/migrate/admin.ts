/**
 * Admin SDK connection for the one-time migrations (Task 1.11). The Admin SDK
 * skips the Firestore rules, so these scripts run only from the owner's
 * machine, never in the app.
 *
 * - Emulator: set FIRESTORE_EMULATOR_HOST (the tests do); no credentials needed.
 * - Production: set GOOGLE_APPLICATION_CREDENTIALS to a service account key
 *   file (Firebase console › Project settings › Service accounts › Generate
 *   new private key), or FIREBASE_SERVICE_ACCOUNT to the key's JSON.
 */
import { cert, getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export const PRODUCTION_PROJECT_ID = "wedding-planning-75c0c";

export function connect(
  name = "migrate",
  /** A project to use whatever the shell says (the fixtures: always the emulators' own). */
  project?: string,
): { db: Firestore; projectId: string; emulator: boolean } {
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const projectId =
    project ?? process.env.FIREBASE_PROJECT_ID ?? (emulator ? "demo-wedding-planning" : PRODUCTION_PROJECT_ID);
  const existing = getApps().find((a) => a.name === name);
  let app: App;
  if (existing) {
    app = existing;
  } else if (emulator) {
    app = initializeApp({ projectId }, name);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    app = initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)), projectId }, name);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    app = initializeApp({ credential: applicationDefault(), projectId }, name);
  } else {
    throw new Error(
      "No credentials. Set GOOGLE_APPLICATION_CREDENTIALS to a service account key file " +
        "(Firebase console › Project settings › Service accounts), or FIREBASE_SERVICE_ACCOUNT to its JSON.",
    );
  }
  return { db: getFirestore(app), projectId, emulator };
}
