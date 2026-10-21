// Runs Playwright with one e2e run at a time across every copy of the repo
// (the main folder and the lanes in redesign/terminal-split.md). An e2e run
// starts two Next dev servers, the Firebase emulators and a browser, and four
// at once overload the machine, so tests time out at random. The lock is a
// folder in the shared .git folder; a run waits while another copy holds it.
// A lock left by a run that died is taken over, and a run gives up after
// E2E_LOCK_WAIT_MINUTES (60) rather than wait forever on a run that hangs or
// was left behind by a session that ended. E2E_LOCK=0 skips the lock.
// It also stops a run whose emulator log floods (see LOG below).
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, truncateSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const WAIT_MS = 5000;
const WAIT_LIMIT_MS = Number(process.env.E2E_LOCK_WAIT_MINUTES ?? 60) * 60_000;
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
  const started = Date.now();
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
    if (owner && Date.now() - started > WAIT_LIMIT_MS) {
      console.error(
        `e2e lock: gave up after ${WAIT_LIMIT_MS / 60_000} minutes waiting for ${owner.copy}'s e2e run ` +
          `(pid ${owner.pid}, since ${owner.since}). If nothing is meant to be running it (a session that ` +
          `ended, a hung run), end it and what it started (/tidy, or kill ${owner.pid}), then run again.`,
      );
      process.exit(1);
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

// The Firestore emulator writes its log here and keeps it until the next run.
// Once a test leaves a live-update connection unread, it logs three warnings
// for every later write: one full run (2026-10-20) wrote 3.7 GB that way, at
// about 150 MB a minute. So each run starts the log empty, and a run whose log
// passes the limit is stopped. Truncating rather than deleting keeps the
// growth visible if a reused emulator still has the file open; disk blocks
// are counted, not the length, because its next write leaves a sparse file.
const LOG = "firestore-debug.log";
const LOG_LIMIT_MB = Number(process.env.E2E_LOG_LIMIT_MB ?? 200);
const watchLog = servers !== "demo";
if (watchLog) {
  try {
    truncateSync(LOG);
  } catch {}
}

function logBytes() {
  try {
    const stat = statSync(LOG);
    return stat.blocks ? stat.blocks * 512 : stat.size;
  } catch {
    return 0;
  }
}

const child = spawn("npx", ["playwright", "test", ...args], {
  stdio: "inherit",
  env: { ...process.env, E2E_SERVERS: servers },
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => child.kill(signal));
}

let flooded = false;
const watcher = watchLog
  ? setInterval(() => {
      if (flooded || logBytes() < LOG_LIMIT_MB * 1024 * 1024) return;
      flooded = true;
      console.error(
        `\ne2e: ${LOG} passed ${LOG_LIMIT_MB} MB: a test left a live-update connection unread and the emulator is ` +
          `flooding its log. Stopping the run. The flood began a minute or two ago, so the cause is among the ` +
          `last tests listed above (look for "too many pending" in ${LOG}).`,
      );
      child.kill("SIGINT");
    }, 10_000)
  : null;

child.on("exit", (code, signal) => {
  if (watcher) clearInterval(watcher);
  release();
  process.exit(flooded ? 1 : (code ?? (signal ? 1 : 0)));
});
