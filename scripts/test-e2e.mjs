// Runs Playwright with one e2e run at a time across every copy of the repo
// (the main folder and the lanes in redesign/terminal-split.md). An e2e run
// starts two Next dev servers, the Firebase emulators and a browser, and four
// at once overload the machine, so tests time out at random. The lock is a
// folder in the shared .git folder; a run waits while another copy holds it.
// A lock left by a run that died is taken over, and a run gives up after
// E2E_LOCK_WAIT_MINUTES (60) rather than wait forever on a run that hangs or
// was left behind by a session that ended. E2E_LOCK=0 skips the lock.
// It also stops a run whose emulator log floods (see LOG below), and runs the
// stress specs in a second pass on fresh servers (see stressSpecs), and splits
// a full run into passes on fresh servers (see CHUNK_TESTS).
import { spawn, execFileSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, rmSync, statSync, truncateSync, writeFileSync } from "node:fs";
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

// The *-stress specs write thousands of records. On an emulator that earlier
// tests used, every write goes to the live-update connections their closed
// pages left behind (the emulator keeps them open for a while), until each
// one's queue passes 10,000 and the emulator retries and warns millions of
// times (Phase 5 runs on 2026-10-20 and 10-22). So when they run together with
// other emulator specs, they get a second pass with fresh servers. Each pass
// keeps its own --last-failed list (the second in test-results/stress).
const STRESS_DIR = "tests/e2e/emulator";
const stressSpecs = readdirSync(STRESS_DIR)
  .filter((name) => name.endsWith("-stress.spec.ts"))
  .map((name) => `${STRESS_DIR}/${name}`);

function matches(filter, file) {
  try {
    return new RegExp(filter).test(file);
  } catch {
    return file.includes(filter);
  }
}

function splitStress(list, servers) {
  if (servers === "demo" || process.env.E2E_STRESS || stressSpecs.length === 0) return false;
  const filters = list.filter((a) => !a.startsWith("-"));
  if (filters.length === 0) return true;
  const stressInScope = filters.some((f) => stressSpecs.some((file) => matches(f, file)));
  const onlyStress = filters.every((f) => stressSpecs.some((file) => matches(f, file)) && /stress/.test(f));
  return stressInScope && !onlyStress;
}

// Even without the stress specs, the emulator's memory grows with every test:
// it keeps what it queued for each closed page's connection. In the Phase 5
// full run (2026-10-22) its 1 GB heap ran out after about 180 emulator tests,
// and every later test hung until its timeout. So a full run (no spec paths,
// filters or --project) runs the demo specs, then the other emulator specs in
// chunks of about CHUNK_TESTS, each on fresh servers, then the stress specs.
// Each pass has its own --output, so --last-failed reruns each one's failures.
const CHUNK_TESTS = Number(process.env.E2E_CHUNK_TESTS ?? 80);

function emulatorChunks() {
  const listed = execFileSync("npx", ["playwright", "test", "--list", "--project=emulator"], {
    encoding: "utf8",
    env: { ...process.env, E2E_STRESS: "skip", E2E_SERVERS: "emulator" },
  });
  const counts = new Map();
  for (const match of listed.matchAll(/(emulator\/[\w.-]+\.spec\.ts):\d+/g)) {
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  const chunks = [];
  let chunk = [];
  let size = 0;
  for (const [file, count] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
    if (chunk.length > 0 && size + count > CHUNK_TESTS) {
      chunks.push(chunk);
      chunk = [];
      size = 0;
    }
    chunk.push(`tests/e2e/${file}`);
    size += count;
  }
  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

const fullRun = !process.env.E2E_SERVERS && !process.env.E2E_STRESS && CHUNK_TESTS > 0 &&
  !args.some((a) => !a.startsWith("-") || a.startsWith("--project") || a === "--grep" || a.startsWith("--grep=") || a === "-g");

const servers = process.env.E2E_SERVERS ?? serversFor(args);
const split = splitStress(args, servers);
const stressPass = {
  args: [...args, "--pass-with-no-tests", "--output=test-results/stress"],
  env: { E2E_STRESS: "only" },
  servers: "emulator",
  note: "e2e: last pass: the stress specs, on fresh servers.",
};
let passes;
if (fullRun) {
  const chunks = emulatorChunks();
  passes = [
    {
      args: [...args, "--project=demo", "--pass-with-no-tests", "--output=test-results/demo"],
      env: {},
      servers: "demo",
      note: "e2e: pass 1: the demo specs.",
    },
    ...chunks.map((files, i) => ({
      args: [...args, ...files, "--pass-with-no-tests", `--output=test-results/emulator-${i + 1}`],
      env: { E2E_STRESS: "skip" },
      servers: "emulator",
      note: `e2e: pass ${i + 2}: emulator specs, part ${i + 1} of ${chunks.length}, on fresh servers.`,
    })),
    ...(stressSpecs.length > 0 ? [stressPass] : []),
  ];
  console.log(`e2e: full run in ${passes.length} passes, each emulator pass on fresh servers (E2E_CHUNK_TESTS=${CHUNK_TESTS}).`);
} else {
  passes = split
    ? [{ args: [...args, "--pass-with-no-tests"], env: { E2E_STRESS: "skip" }, servers }, stressPass]
    : [{ args, env: {}, servers }];
  if (servers !== "all") console.log(`e2e: starting only the ${servers} servers for these specs.`);
  if (split) console.log("e2e: the stress specs run in a second pass with fresh servers, after the rest.");
}

// The Firestore emulator writes its log here and keeps it until the next run.
// Once a test leaves a live-update connection unread, it logs three warnings
// for every later write: one full run (2026-10-20) wrote 3.7 GB that way, at
// about 150 MB a minute. So each pass starts the log empty, and a pass whose
// log passes the limit is stopped. Truncating rather than deleting keeps the
// growth visible if a reused emulator still has the file open; disk blocks
// are counted, not the length, because its next write leaves a sparse file.
const LOG = "firestore-debug.log";
const LOG_LIMIT_MB = Number(process.env.E2E_LOG_LIMIT_MB ?? 200);

function logBytes() {
  try {
    const stat = statSync(LOG);
    return stat.blocks ? stat.blocks * 512 : stat.size;
  } catch {
    return 0;
  }
}

// Playwright runs in its own process group, and a stop goes to the whole
// group: sent to npx alone, a SIGINT left Playwright, both dev servers and the
// emulator running after the run had ended (2026-10-22). Whatever is still
// there 30 seconds later is killed.
let child = null;
let stopped = false;
let flooded = false;

function stop(signal) {
  if (!child) return;
  const group = -child.pid;
  try {
    process.kill(group, signal);
  } catch {}
  setTimeout(() => {
    try {
      process.kill(group, "SIGKILL");
    } catch {}
  }, 30_000).unref();
}
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    stopped = true;
    stop(signal);
  });
}

// An emulator out of heap answers nothing, so each later test hangs until
// its timeout (hours for a full run); a pass whose log reports it is stopped.
function outOfMemory() {
  let fd;
  try {
    fd = openSync(LOG, "r");
    const size = statSync(LOG).size;
    const length = Math.min(size, 256 * 1024);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    return buffer.includes("OutOfMemoryError");
  } catch {
    return false;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

// Playwright starts each web server (the dev servers, the emulators) in a
// process group of its own, which the group kill above can't reach. After a
// pass, whatever still listens on this copy's own test ports (the offsets in
// tests/e2e/emulator-config.ts) is one of them, so it is stopped. Other
// copies and other projects use other ports and are never touched.
function ownPorts() {
  const raw =
    process.env.TEST_PORT_OFFSET ?? (() => {
      try {
        return readFileSync(".test-port-offset", "utf8").trim();
      } catch {
        return "0";
      }
    })();
  const offset = Number(raw);
  if (!Number.isInteger(offset) || offset < 0 || offset > 90) return [];
  return [3100, 3101, 9099, 8080, 9150, 4400, 4500].map((port) => port + offset);
}

function freeOwnPorts() {
  for (const port of ownPorts()) {
    let listening = "";
    try {
      listening = execFileSync("ss", ["-ltnpH", `sport = :${port}`], { encoding: "utf8" });
    } catch {
      continue;
    }
    for (const [, pid] of listening.matchAll(/pid=(\d+)/g)) {
      console.error(`e2e: stopping process ${pid}, left listening on this copy's test port ${port}.`);
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {}
    }
  }
}

function runPass(pass) {
  const watchLog = pass.servers !== "demo";
  if (watchLog) {
    try {
      truncateSync(LOG);
    } catch {}
  }
  if (pass.note) console.log(`\n${pass.note}`);
  child = spawn("npx", ["playwright", "test", ...pass.args], {
    stdio: "inherit",
    env: { ...process.env, ...pass.env, E2E_SERVERS: pass.servers },
    detached: true,
  });
  const watcher = watchLog
    ? setInterval(() => {
        if (flooded) return;
        if (outOfMemory()) {
          flooded = true;
          console.error(
            `\ne2e: the Firestore emulator ran out of memory (OutOfMemoryError in ${LOG}), so every later test ` +
              `would hang. Stopping the run. Lower E2E_CHUNK_TESTS, or look for a test that leaves pages listening.`,
          );
          stop("SIGINT");
          return;
        }
        if (logBytes() < LOG_LIMIT_MB * 1024 * 1024) return;
        flooded = true;
        console.error(
          `\ne2e: ${LOG} passed ${LOG_LIMIT_MB} MB: a test left a live-update connection unread and the emulator is ` +
            `flooding its log. Stopping the run. The flood began a minute or two ago, so the cause is among the ` +
            `last tests listed above (look for "too many pending" in ${LOG}).`,
        );
        stop("SIGINT");
      }, 10_000)
    : null;
  return new Promise((resolve) => {
    child.on("exit", (code, signal) => {
      if (watcher) clearInterval(watcher);
      // Anything the pass left in its group, then on this copy's own ports.
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
      freeOwnPorts();
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

let exitCode = 0;
for (const pass of passes) {
  const code = await runPass(pass);
  if (code !== 0) exitCode = code;
  if (stopped || flooded) break;
}
release();
process.exit(flooded ? 1 : exitCode);
