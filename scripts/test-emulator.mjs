// Runs the Vitest "emulator" project inside a fresh Firebase emulator
// (Auth + Firestore, with firestore.rules). The emulators need Java; Homebrew's
// openjdk is keg-only, so its bin folder is added to PATH when present.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const BREW_JAVA_BIN = "/opt/homebrew/opt/openjdk/bin";
const env = { ...process.env };
if (existsSync(BREW_JAVA_BIN)) env.PATH = `${BREW_JAVA_BIN}:${env.PATH}`;

const extra = process.argv.slice(2).join(" ");
const result = spawnSync(
  "npx",
  [
    "firebase",
    "emulators:exec",
    "--only",
    "auth,firestore",
    "--project",
    "demo-wedding-planning",
    `npx vitest run --project emulator ${extra}`.trim(),
  ],
  { stdio: "inherit", env },
);
process.exit(result.status ?? 1);
