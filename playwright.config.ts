import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
import {
  EMULATOR_PROJECT_ID,
  FIRESTORE_EMULATOR,
} from "./tests/e2e/emulator-config";

const EMULATOR_APP_PORT = 3100;
const DEMO_APP_PORT = 3101;

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
  NEXT_PUBLIC_FIREBASE_API_KEY: "fake-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "localhost",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: EMULATOR_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:0:web:test",
  NEXT_DIST_DIR: ".next-e2e",
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
    {
      command: `npx firebase emulators:start --only auth,firestore --project ${EMULATOR_PROJECT_ID}`,
      url: `http://${FIRESTORE_EMULATOR}`,
      env: { PATH: emulatorPath ?? "" },
      // Without a graceful stop, the emulator's Java process outlives the run.
      gracefulShutdown: { signal: "SIGINT", timeout: 15_000 },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npx next dev --port ${EMULATOR_APP_PORT}`,
      url: `http://localhost:${EMULATOR_APP_PORT}/login`,
      env: emulatorAppEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npx next dev --port ${DEMO_APP_PORT}`,
      url: `http://localhost:${DEMO_APP_PORT}/login`,
      env: demoAppEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
