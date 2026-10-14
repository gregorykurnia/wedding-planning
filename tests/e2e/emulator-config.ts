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
