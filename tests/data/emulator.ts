import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  terminate,
  type Firestore,
} from "firebase/firestore";
import {
  AUTH_EMULATOR,
  EMULATOR_PROJECT_ID,
  FIRESTORE_EMULATOR,
  TEST_ACCOUNTS,
} from "../e2e/emulator-config";

/**
 * One signed-in client per partner, each its own FirebaseApp, so two writers
 * really race each other through the emulator the way two phones would.
 */
export interface Partner {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  uid: string;
}

let count = 0;

export function makeClient(name = `client-${++count}`) {
  const app = initializeApp(
    {
      apiKey: "fake-api-key",
      authDomain: "localhost",
      projectId: EMULATOR_PROJECT_ID,
      appId: "1:0:web:test",
    },
    name,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${AUTH_EMULATOR}`, { disableWarnings: true });
  const db = getFirestore(app);
  const [host, port] = FIRESTORE_EMULATOR.split(":");
  connectFirestoreEmulator(db, host, Number(port));
  return { app, auth, db };
}

export async function signIn(
  client: { app: FirebaseApp; auth: Auth; db: Firestore },
  account: { email: string; password: string },
): Promise<Partner> {
  const { user } = await signInWithEmailAndPassword(client.auth, account.email, account.password);
  return { ...client, uid: user.uid };
}

/** Gregory and Bella, signed in on two separate clients. */
export async function twoPartners(): Promise<[Partner, Partner]> {
  const partners = await Promise.all([
    signIn(makeClient(), TEST_ACCOUNTS[0]),
    signIn(makeClient(), TEST_ACCOUNTS[1]),
  ]);
  await Promise.all(partners.map(warmUp));
  return partners as [Partner, Partner];
}

/**
 * One untimed write and read per client before the tests start. A freshly
 * started emulator can take longer than the write layer's 10 seconds to answer
 * its first write, which would read as a timeout.
 */
export async function warmUp(client: { db: Firestore; uid?: string }) {
  const ref = doc(client.db, "settings", `warm-up-${client.uid ?? "anonymous"}`);
  await setDoc(ref, { at: Date.now() });
  await getDoc(ref);
}

export async function closeClient(client: { app: FirebaseApp; db: Firestore }) {
  await terminate(client.db);
  await deleteApp(client.app);
}

/** Empties the Firestore emulator (accounts stay). */
export async function clearFirestore() {
  const res = await fetch(
    `http://${FIRESTORE_EMULATOR}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(`Clearing Firestore emulator failed: ${res.status}`);
}
