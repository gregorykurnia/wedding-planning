// Runs Playwright with one e2e run at a time across every copy of the repo
// (the main folder and the lanes in redesign/terminal-split.md). An e2e run
// starts two Next dev servers, the Firebase emulators and a browser, and four
// at once overload the machine, so tests time out at random. The lock is a
// folder in the shared .git folder; a run waits while another copy holds it.
// A lock left by a run that died is taken over. E2E_LOCK=0 skips the lock.
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const WAIT_MS = 5000;
const args = process.argv.slice(2);

function lockDir() {
  const common = execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
    { encoding: "utf8" },
  ).trim();
  return join(common, "e2e.lock");
}

function holder(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, "owner.json"), "utf8"));
  } catch {
    return null;
  }
}

function mtime(dir) {
  try {
    return statSync(dir).mtimeMs;
  } catch {
    return 0;
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function acquire(dir) {
  let told = false;
  for (;;) {
    try {
      mkdirSync(dir);
      writeFileSync(
        join(dir, "owner.json"),
        JSON.stringify({ pid: process.pid, copy: basename(process.cwd()), since: new Date().toISOString() }),
      );
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const owner = holder(dir);
    // No owner file means another run is between mkdir and write, or died
    // there; after a minute it counts as dead.
    const dead = owner ? !alive(owner.pid) : Date.now() - mtime(dir) > 60_000;
    if (dead) {
      console.log(`e2e lock: ${owner ? `${owner.copy}'s run (pid ${owner.pid})` : "an unfinished run"} has ended; taking the lock.`);
      rmSync(dir, { recursive: true, force: true });
      continue;
    }
    if (!told && owner) {
      console.log(`e2e lock: waiting for ${owner.copy}'s e2e run (pid ${owner.pid}, since ${owner.since}).`);
      told = true;
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_MS));
  }
}

const useLock = process.env.E2E_LOCK !== "0";
const dir = useLock ? lockDir() : null;
if (dir) await acquire(dir);

function release() {
  if (dir && holder(dir)?.pid === process.pid) rmSync(dir, { recursive: true, force: true });
}

// Start only the servers the chosen specs need (see playwright.config.ts):
// every spec path under tests/e2e/demo/ (or --project=demo) needs only the
// demo server, every one under tests/e2e/emulator/ only the emulators'.
function serversFor(list) {
  const flag = list.findIndex((a) => a === "--project" || a.startsWith("--project="));
  if (flag !== -1) {
    const name = list[flag].includes("=") ? list[flag].split("=")[1] : list[flag + 1];
    if (name === "demo" || name === "emulator") return name;
  }
  const paths = list.filter((a) => !a.startsWith("-") && /e2e\/(demo|emulator)\//.test(a));
  if (paths.length === 0 || paths.length !== list.filter((a) => !a.startsWith("-")).length) return "all";
  if (paths.every((a) => a.includes("e2e/demo/"))) return "demo";
  if (paths.every((a) => a.includes("e2e/emulator/"))) return "emulator";
  return "all";
}

const servers = process.env.E2E_SERVERS ?? serversFor(args);
if (servers !== "all") console.log(`e2e: starting only the ${servers} servers for these specs.`);
const child = spawn("npx", ["playwright", "test", ...args], {
  stdio: "inherit",
  env: { ...process.env, E2E_SERVERS: servers },
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => {
  release();
  process.exit(code ?? (signal ? 1 : 0));
});
