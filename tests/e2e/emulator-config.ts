// Shared by playwright.config.ts, seed.ts, the emulator specs and
// scripts/test-emulator.mjs.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const EMULATOR_PROJECT_ID = "demo-wedding-planning";

// Each copy of the repo (see redesign/terminal-split.md) moves every test port
// by its own offset, so test runs in two copies at once don't collide. The
// offset comes from TEST_PORT_OFFSET or a git-ignored `.test-port-offset`
// file in the copy's root; the main copy has neither and uses 0.
function portOffset(): number {
  const raw =
    process.env.TEST_PORT_OFFSET ??
    (existsSync(".test-port-offset")
      ? readFileSync(".test-port-offset", "utf8").trim()
      : "0");
  const offset = Number(raw);
  if (!Number.isInteger(offset) || offset < 0 || offset > 90) {
    throw new Error(`Test port offset must be a whole number from 0 to 90, got "${raw}"`);
  }
  return offset;
}

export const PORT_OFFSET = portOffset();
export const TEST_PORTS = {
  emulatorApp: 3100 + PORT_OFFSET,
  demoApp: 3101 + PORT_OFFSET,
  auth: 9099 + PORT_OFFSET,
  firestore: 8080 + PORT_OFFSET,
  firestoreWebsocket: 9150 + PORT_OFFSET,
  hub: 4400 + PORT_OFFSET,
  logging: 4500 + PORT_OFFSET,
};

export const AUTH_EMULATOR = `127.0.0.1:${TEST_PORTS.auth}`;
export const FIRESTORE_EMULATOR = `127.0.0.1:${TEST_PORTS.firestore}`;

// The emulators read their ports from a firebase.json, so the test runs start
// them with a copy of it carrying these ports (git-ignored). The name carries
// the offset so two runs from one folder can't read each other's ports.
export const EMULATOR_CONFIG_FILE = `.firebase-test-${PORT_OFFSET}.json`;

export function writeEmulatorConfig(): string {
  const config = JSON.parse(readFileSync("firebase.json", "utf8"));
  config.emulators = {
    ...config.emulators,
    auth: { ...config.emulators?.auth, port: TEST_PORTS.auth },
    firestore: {
      ...config.emulators?.firestore,
      port: TEST_PORTS.firestore,
      websocketPort: TEST_PORTS.firestoreWebsocket,
    },
    hub: { host: "127.0.0.1", port: TEST_PORTS.hub },
    logging: { host: "127.0.0.1", port: TEST_PORTS.logging },
  };
  writeFileSync(EMULATOR_CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);
  return join(process.cwd(), EMULATOR_CONFIG_FILE);
}

// Emails the Firestore rules allow (see firestore.rules).
export const TEST_ACCOUNTS = [
  { email: "gregory.kurnia@gmail.com", password: "test-password-1" },
  { email: "bellabarliana15@gmail.com", password: "test-password-2" },
] as const;

// The app servers' environment for the e2e runs (playwright.config.ts), also
// used by scripts/test-e2e.mjs to build both apps first when E2E_BUILD=1.
// Placeholder web config for the emulator build. The real values in
// .env.local are overridden here so the tests can never reach production.
export const EMULATOR_APP_ENV: Record<string, string> = {
  NEXT_PUBLIC_USE_EMULATORS: "1",
  NEXT_PUBLIC_AUTH_EMULATOR: AUTH_EMULATOR,
  NEXT_PUBLIC_FIRESTORE_EMULATOR: FIRESTORE_EMULATOR,
  NEXT_PUBLIC_FIREBASE_API_KEY: "fake-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "localhost",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: EMULATOR_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:0:web:test",
  NEXT_DIST_DIR: ".next-e2e",
  // Shows the new UI's dev-only gallery pages.
  NEXT_PUBLIC_VEIL_GALLERY: "1",
  // Keeps the sign-in screen (OPEN_ACCESS in src/lib/data/session.ts), so the
  // specs still sign in as the test accounts and cover sign-in itself.
  NEXT_PUBLIC_REQUIRE_SIGN_IN: "1",
  // Turns on `?fault=` (src/lib/data/dev-faults.ts).
  NEXT_PUBLIC_VEIL_DEV: "1",
  // Fake Cloudinary config so the upload controls are enabled. The specs
  // stub every request to api.cloudinary.com, so nothing leaves the machine.
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "test-cloud",
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: "test-preset",
  // A throwaway VAPID public key: the specs stub the browser's push manager,
  // and no private key exists for it.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "BFQ4oSwuS89KgDx5UcyfB-URJxEU9HvlFEOdcm_V3k9TTUhvRVAbEE_RVRYrOoUvTM5QvDGAm2aPFtl9LZoWOCE",
};

// Demo mode: every Firebase variable empty. Values already in the process
// environment win over .env.local, so the empty strings stick.
export const DEMO_APP_ENV: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "",
  NEXT_PUBLIC_FIREBASE_APP_ID: "",
  NEXT_DIST_DIR: ".next-demo",
  NEXT_PUBLIC_VEIL_GALLERY: "1",
};
