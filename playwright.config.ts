import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
import {
  AUTH_EMULATOR,
  EMULATOR_PROJECT_ID,
  FIRESTORE_EMULATOR,
  TEST_PORTS,
  writeEmulatorConfig,
} from "./tests/e2e/emulator-config";

// Ports move by this copy's offset (see tests/e2e/emulator-config.ts).
const EMULATOR_APP_PORT = TEST_PORTS.emulatorApp;
const DEMO_APP_PORT = TEST_PORTS.demoApp;
const emulatorConfigFile = writeEmulatorConfig();

// Which servers this run starts (set by scripts/test-e2e.mjs from the spec
// paths): "demo" skips the emulators and their dev server, "emulator" skips
// the demo dev server. Each Next dev server takes a gigabyte or more, so a
// run of one spec starts only what it needs.
const SERVERS = process.env.E2E_SERVERS ?? "all";
const needsEmulator = SERVERS !== "demo";
const needsDemo = SERVERS !== "emulator";

// The Firebase emulators need Java. Homebrew's openjdk is keg-only, so it is
// not on PATH unless the owner linked it.
const BREW_JAVA_BIN = "/opt/homebrew/opt/openjdk/bin";
const emulatorPath = existsSync(BREW_JAVA_BIN)
  ? `${BREW_JAVA_BIN}:${process.env.PATH}`
  : process.env.PATH;

// Placeholder web config for the emulator build. The real values in
// .env.local are overridden here so the tests can never reach production.
const emulatorAppEnv = {
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
  // Fake Cloudinary config so the upload controls are enabled. The specs
  // stub every request to api.cloudinary.com, so nothing leaves the machine.
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "test-cloud",
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: "test-preset",
};

// Demo mode: every Firebase variable empty. Values already in the process
// environment win over .env.local, so the empty strings stick.
const demoAppEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "",
  NEXT_PUBLIC_FIREBASE_APP_ID: "",
  NEXT_DIST_DIR: ".next-demo",
  NEXT_PUBLIC_VEIL_GALLERY: "1",
};

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  // The first visit to each page compiles it in dev mode, which can take a
  // while, so a whole test gets more than Playwright's default 30 seconds.
  timeout: 150_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  projects: [
    {
      name: "emulator",
      testMatch: "emulator/**/*.spec.ts",
      use: { baseURL: `http://localhost:${EMULATOR_APP_PORT}` },
    },
    {
      name: "demo",
      testMatch: "demo/**/*.spec.ts",
      use: { baseURL: `http://localhost:${DEMO_APP_PORT}` },
    },
  ],
  webServer: [
    ...(needsEmulator ? [{
      command: `npx firebase emulators:start --config ${emulatorConfigFile} --only auth,firestore --project ${EMULATOR_PROJECT_ID}`,
      url: `http://${FIRESTORE_EMULATOR}`,
      env: { PATH: emulatorPath ?? "" },
      // Without a graceful stop, the emulator's Java process outlives the run.
      gracefulShutdown: { signal: "SIGINT" as const, timeout: 15_000 },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npx next dev --port ${EMULATOR_APP_PORT}`,
      url: `http://localhost:${EMULATOR_APP_PORT}/login`,
      env: emulatorAppEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    }] : []),
    ...(needsDemo ? [{
      command: `npx next dev --port ${DEMO_APP_PORT}`,
      url: `http://localhost:${DEMO_APP_PORT}/login`,
      env: demoAppEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    }] : []),
  ],
});
