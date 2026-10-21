// Runs the Vitest "emulator" project inside a fresh Firebase emulator
// (Auth + Firestore, with firestore.rules). The emulators need Java; Homebrew's
// openjdk is keg-only, so its bin folder is added to PATH when present.
// Ports follow this copy's test port offset (tests/e2e/emulator-config.ts).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { writeEmulatorConfig } from "../tests/e2e/emulator-config.ts";

const BREW_JAVA_BIN = "/opt/homebrew/opt/openjdk/bin";
const env = { ...process.env };
if (existsSync(BREW_JAVA_BIN)) env.PATH = `${BREW_JAVA_BIN}:${env.PATH}`;
// Caps the emulator's Java heap, as playwright.config.ts does for e2e.
env.JAVA_TOOL_OPTIONS = "-Xmx1g";

const extra = process.argv.slice(2).join(" ");
const result = spawnSync(
  "npx",
  [
    "firebase",
    "emulators:exec",
    "--config",
    writeEmulatorConfig(),
    "--only",
    "auth,firestore",
    "--project",
    "demo-wedding-planning",
    `npx vitest run --project emulator ${extra}`.trim(),
  ],
  { stdio: "inherit", env },
);
process.exit(result.status ?? 1);
