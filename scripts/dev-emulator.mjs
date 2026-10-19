// Runs the dev server against the local Firebase emulators with ?fault= switched
// on (src/lib/data/dev-faults.ts): the preview for checking states against a
// fixture set. Start the emulators and fill them first (see `npm run seed:emulator`).
// Ports follow this copy's test port offset (tests/e2e/emulator-config.ts); the
// Firebase values are overridden, so this can never reach production.
import { spawn } from "node:child_process";
import { AUTH_EMULATOR, EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, PORT_OFFSET, TEST_ACCOUNTS } from "../tests/e2e/emulator-config.ts";

const port = 3000 + PORT_OFFSET;
const env = {
  ...process.env,
  NEXT_PUBLIC_USE_EMULATORS: "1",
  NEXT_PUBLIC_AUTH_EMULATOR: AUTH_EMULATOR,
  NEXT_PUBLIC_FIRESTORE_EMULATOR: FIRESTORE_EMULATOR,
  NEXT_PUBLIC_FIREBASE_API_KEY: "fake-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "localhost",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: EMULATOR_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:0:web:test",
  NEXT_PUBLIC_VEIL_DEV: "1",
  NEXT_PUBLIC_VEIL_GALLERY: "1",
};

console.log(`http://localhost:${port}/new  (sign in as ${TEST_ACCOUNTS[0].email} / ${TEST_ACCOUNTS[0].password})`);
console.log("Add ?fault=save|load|offline|upload (comma-separated; ?fault=off clears) to any address.");
const child = spawn("npx", ["next", "dev", "--port", String(port)], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
