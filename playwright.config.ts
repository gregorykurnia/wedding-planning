import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import {
  DEMO_APP_ENV,
  EMULATOR_APP_ENV,
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
const STRESS = process.env.E2E_STRESS;
const STRESS_SPECS = "emulator/**/*-stress.spec.ts";
// E2E_BUILD=1 (scripts/test-e2e.mjs builds both apps first): the app servers
// run the production builds with `next start` instead of `next dev`.
const NEXT = process.env.E2E_BUILD === "1" ? "start" : "dev";

// The Firebase emulators need Java. Homebrew's openjdk is keg-only, so it is
// not on PATH unless the owner linked it.
const BREW_JAVA_BIN = "/opt/homebrew/opt/openjdk/bin";
const emulatorPath = existsSync(BREW_JAVA_BIN)
  ? `${BREW_JAVA_BIN}:${process.env.PATH}`
  : process.env.PATH;

// Never reuse a server already on a test port: on a shared machine it can be
// another program (code-server answers on 8080, another project's app on 3100),
// and Playwright takes any answer below 404 as this run's server, so every test
// then fails against the wrong one. A taken port now stops the run at once;
// give the copy its own ports with `.test-port-offset`. A leftover from an
// earlier run of this copy is ended first (see /tidy).
const REUSE = false;

// The Firestore emulator's Java process can otherwise grow to a quarter of the
// machine's memory; the test data needs far less, so a runaway fails fast
// instead of making the machine swap. Also set in scripts/test-emulator.mjs.
// The logging file keeps the emulator's live-update warnings out of
// firestore-debug.log (see the file; P5-S29).
const EMULATOR_JAVA_OPTIONS =
  `-Xmx1g -Djava.util.logging.config.file=${join(process.cwd(), "tests/e2e/emulator-logging.properties")}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  workers: 1,
  // The first visit to each page compiles it in dev mode, which can take a
  // while, so a whole test gets more than Playwright's default 30 seconds.
  timeout: 150_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  // E2E_STRESS (set by scripts/test-e2e.mjs): "skip" leaves out the *-stress
  // specs, "only" runs nothing else. They write thousands of records, which
  // flood the live-update connections earlier tests leave behind on the
  // emulator, so a run that includes other specs gives them a second pass on
  // fresh servers.
  projects: [
    {
      name: "emulator",
      testMatch: STRESS === "only" ? STRESS_SPECS : "emulator/**/*.spec.ts",
      testIgnore: STRESS === "skip" ? STRESS_SPECS : undefined,
      use: { baseURL: `http://localhost:${EMULATOR_APP_PORT}` },
    },
    ...(STRESS === "only" ? [] : [{
      name: "demo",
      testMatch: "demo/**/*.spec.ts",
      use: { baseURL: `http://localhost:${DEMO_APP_PORT}` },
    }]),
  ],
  webServer: [
    ...(needsEmulator ? [{
      command: `npx firebase emulators:start --config ${emulatorConfigFile} --only auth,firestore --project ${EMULATOR_PROJECT_ID}`,
      url: `http://${FIRESTORE_EMULATOR}`,
      env: { PATH: emulatorPath ?? "", JAVA_TOOL_OPTIONS: EMULATOR_JAVA_OPTIONS },
      // Without a graceful stop, the emulator's Java process outlives the run.
      gracefulShutdown: { signal: "SIGINT" as const, timeout: 15_000 },
      reuseExistingServer: REUSE,
      timeout: 120_000,
    },
    {
      command: `npx next ${NEXT} --port ${EMULATOR_APP_PORT}`,
      url: `http://localhost:${EMULATOR_APP_PORT}/login`,
      env: EMULATOR_APP_ENV,
      reuseExistingServer: REUSE,
      timeout: 120_000,
    }] : []),
    ...(needsDemo ? [{
      command: `npx next ${NEXT} --port ${DEMO_APP_PORT}`,
      url: `http://localhost:${DEMO_APP_PORT}/login`,
      env: DEMO_APP_ENV,
      reuseExistingServer: REUSE,
      timeout: 120_000,
    }] : []),
  ],
});
