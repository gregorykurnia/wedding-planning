// Task 8.2: screenshot comparison. Captures every row of plan §5.1 (screen × state) on the
// prototype (`redesign/design/prototype/`, served statically) and on a production build of the
// app against the Firebase emulators with the matching fixture set, at 390px and 1440px, light only,
// motion reduced, fonts loaded and the browser clock fixed to the prototype's "today"
// (14 October 2026, 11:30). It writes side-by-side images (prototype | build | difference) and a
// pixel-difference score per row to tests/screenshots/report/ (git-ignored: never commit it).
//
//   node scripts/screenshots.mjs [--only <text>]... [--device phone|desktop] [--side both|proto|build]
//                                [--fresh] [--no-build] [--axe] [--list]
//
// --only      group or row filter, repeatable; matches the group's slug or title, or part of a row's id
//             or label (`--only budget`, `--only budget--offline`, `--only "Bella"`).
// --fresh     retake the prototype's shots (otherwise kept between runs: it doesn't change).
// --no-build  reuse the production builds from an earlier run (.next-shots, .next-shots-demo).
// --side      `build` skips the prototype (a fix session reruns only the build's shots for its rows).
// --resume    skips build shots already taken without an error (after a run that stopped part-way).
// --axe       Task 8.4: no screenshots and no prototype; opens each row's state on the build and runs axe
//             (WCAG 2.2 A and AA) on it, then writes axe/ (one JSON per row and size) and axe.md to the report.
// --list      prints the rows the filters pick and stops.
//
// Needs the emulators' ports free (this copy's test ports, tests/e2e/emulator-config.ts), so don't
// run it beside `npm run test:e2e`. It starts the emulators and the servers itself and stops them
// by PID. Image work uses `sharp`, which `next` brings in (not a direct dependency).
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, createReadStream } from "node:fs";
import { extname, join, resolve } from "node:path";
import net from "node:net";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import sharp from "sharp";
import { DEMO_APP_ENV, EMULATOR_APP_ENV, EMULATOR_PROJECT_ID, PORT_OFFSET, TEST_ACCOUNTS, TEST_PORTS, writeEmulatorConfig } from "../tests/e2e/emulator-config.ts";
import { GROUPS, rowsOf } from "../tests/screenshots/rows.mjs";

const ROOT = process.cwd();
const REPORT = join(ROOT, "tests/screenshots/report");
const PROTOTYPE = join(ROOT, "redesign/design/prototype");
const SIZES = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
// A page taller than this is cut off at it in both shots: the stress sets run to tens of thousands of pixels.
const MAX_HEIGHT = { phone: 5000, desktop: 4000 };
const TODAY = "2026-10-14T11:30:00Z";
const PROTO_PORT = 3102 + PORT_OFFSET;
const APP_PORT = 3102 + PORT_OFFSET + 10;
const DEMO_PORT = APP_PORT + 1;

// ---- arguments ----
const args = process.argv.slice(2);
const only = [];
let devices = ["phone", "desktop"];
let side = "both";
let fresh = false;
let noBuild = false;
let list = false;
let resume = false;
let axe = false;
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === "--only") only.push(args[++i].toLowerCase());
  else if (a === "--device") devices = [args[++i]];
  else if (a === "--side") side = args[++i];
  else if (a === "--fresh") fresh = true;
  else if (a === "--no-build") noBuild = true;
  else if (a === "--list") list = true;
  else if (a === "--resume") resume = true;
  else if (a === "--axe") {
    axe = true;
    side = "build";
  }
  else {
    console.error(`Unknown argument ${a}`);
    process.exit(1);
  }
}
if (!devices.every((d) => d in SIZES) || !["both", "proto", "build"].includes(side)) {
  console.error("--device is phone or desktop; --side is both, proto or build");
  process.exit(1);
}

const all = rowsOf(GROUPS);
const picked = all.filter((r) => only.length === 0 || only.some((o) => r.group.slug === o || r.group.title.toLowerCase() === o || r.id.includes(o) || r.label.toLowerCase().includes(o)));
if (list) {
  for (const r of picked) console.log(r.skip ? `${r.id}\tSKIP: ${r.skip}` : `${r.id}\t${r.build.app}/${r.build.fixture}${r.build.dirty ? " (writes)" : ""}`);
  console.log(`${picked.length} rows`);
  process.exit(0);
}
if (picked.length === 0) {
  console.error("No row matches the --only filters.");
  process.exit(1);
}

// ---- processes this run starts (stopped by PID at the end) ----
const children = [];
function start(command, argv, env, label) {
  const child = spawn(command, argv, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let tail = "";
  for (const s of [child.stdout, child.stderr]) s.on("data", (d) => (tail = (tail + d).slice(-4000)));
  child.tail = () => tail;
  child.label = label;
  children.push(child);
  return child;
}
function stopAll() {
  for (const c of children) {
    try {
      process.kill(-c.pid, "SIGINT");
    } catch {}
  }
  setTimeout(() => {
    for (const c of children) {
      try {
        process.kill(-c.pid, "SIGKILL");
      } catch {}
    }
  }, 8000).unref();
}
process.on("SIGINT", () => {
  stopAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(143);
});

const portOpen = (port) =>
  new Promise((ok) => {
    const s = net.connect(port, "127.0.0.1");
    s.on("connect", () => (s.destroy(), ok(true)));
    s.on("error", () => ok(false));
  });
async function waitFor(check, what, ms = 180_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${what}`);
}
const httpOk = async (url) => {
  try {
    return (await fetch(url, { redirect: "manual" })).status < 500;
  } catch {
    return false;
  }
};

// ---- the prototype, served statically ----
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json" };
function serveProto() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = resolve(PROTOTYPE, `.${path === "/" ? "/index.html" : path}`);
    if (!file.startsWith(PROTOTYPE) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(PROTO_PORT, "127.0.0.1", () => ok(server)));
}

// ---- file names and capture helpers ----
const dir = (name) => {
  const d = join(REPORT, name);
  mkdirSync(d, { recursive: true });
  return d;
};
const shot = (kind, row, device) => join(dir(axe && kind === "build" ? "axe" : kind), `${row.id}--${device}.png`);

async function settle(page, ms = 500) {
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(ms);
}

const pageHeight = (page) => page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0));

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** --axe: the same wait for the page to hold still, then axe instead of a picture. */
async function audit(page, patient) {
  let height = await pageHeight(page);
  let steady = 0;
  for (let i = 0; i < (patient ? 60 : 12) && steady < (patient ? 8 : 1); i += 1) {
    await page.waitForTimeout(250);
    const next = await pageHeight(page);
    steady = next === height ? steady + 1 : 0;
    height = next;
  }
  const { violations, incomplete } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  // The guide's 34px bar for pills, toolbar buttons, stars, ticks and steppers (§8): axe only checks 24px, so list
  // every shown control under 34px in a side for a person to compare with the guide's smaller named targets.
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, [role="checkbox"], [role="radio"], summary, select, a[class*="btn"]')]
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0 && (box.height < 34 || box.width < 34))
      .map(({ el, box }) => ({ tag: el.tagName.toLowerCase(), cls: String(el.className).replace(/[\w-]*module__\w{6}__/g, ""), label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30), w: Math.round(box.width), h: Math.round(box.height) })),
  );
  const slim = (v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 220), why: (n.any[0] ?? n.all[0] ?? n.none[0])?.message })) });
  return { small, violations: violations.map(slim), incomplete: incomplete.map((v) => ({ id: v.id, count: v.nodes.length })) };
}

async function take(page, device, path, patient = false) {
  if (axe) return audit(page, patient);
  // A page can still be laying out (lists arrive after the first paint): wait for the height to hold.
  let height = await pageHeight(page);
  // Stress data takes seconds to arrive and draw: it must hold for 2 seconds, not one look.
  let steady = 0;
  for (let i = 0; i < (patient ? 60 : 12) && steady < (patient ? 8 : 1); i += 1) {
    await page.waitForTimeout(250);
    const next = await pageHeight(page);
    steady = next === height ? steady + 1 : 0;
    height = next;
  }
  if (process.env.SHOTS_VERBOSE && height <= SIZES[device].height) {
    console.log("  height", await page.evaluate(() => JSON.stringify({ doc: document.documentElement.scrollHeight, body: document.body.scrollHeight, main: document.querySelector("main")?.scrollHeight, inner: innerHeight, bodyStyle: getComputedStyle(document.body).overflow + "/" + getComputedStyle(document.documentElement).overflow, scrollers: [...document.querySelectorAll("*")].filter((e) => e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY)).map((e) => `${e.tagName}.${e.className}:${e.scrollHeight}/${e.clientHeight}`).slice(0, 5), tall: [...document.querySelectorAll("body *")].map((e) => e.getBoundingClientRect().bottom + scrollY).sort((a, b) => b - a)[0] })));
  }
  const { width } = SIZES[device];
  const cut = Math.min(height, MAX_HEIGHT[device]);
  await page.screenshot({ path, fullPage: true, clip: { x: 0, y: 0, width, height: cut }, animations: "disabled" });
  return { height, cut };
}

const HIDE_PROTO_TAB = ".proto, details.proto { display: none !important; }";

const contextOptions = (device) => ({
  viewport: SIZES[device],
  deviceScaleFactor: 1,
  isMobile: device === "phone",
  hasTouch: device === "phone",
  reducedMotion: "reduce",
  colorScheme: "light",
  timezoneId: "UTC",
  locale: "en-US",
  serviceWorkers: "block",
});

async function newContext(browser, device) {
  const context = await browser.newContext(contextOptions(device));
  await context.clock.setFixedTime(new Date(TODAY));
  // The prototype's normal state has reminders allowed; headless Chromium reports them turned off.
  await context.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "granted", configurable: true }));
  return context;
}

// ---- the prototype's shots ----
async function protoShots(browser, rows) {
  for (const device of devices) {
    const context = await newContext(browser, device);
    for (const row of rows) {
      const out = shot("proto", row, device);
      if (!fresh && existsSync(out)) continue;
      const page = await context.newPage();
      const url = `http://127.0.0.1:${PROTO_PORT}/${row.proto.file}${row.proto.query ? `${row.proto.file.includes("?") ? "&" : "?"}${row.proto.query}` : ""}`;
      const result = { row: row.id, device, side: "proto" };
      try {
        await page.goto(url, { waitUntil: "load" });
        await page.addStyleTag({ content: HIDE_PROTO_TAB });
        await settle(page, 400);
        if (row.proto.run) {
          await row.proto.run(page, helpers(page));
          await settle(page, 300);
        }
        Object.assign(result, await take(page, device, out));
      } catch (error) {
        result.error = String(error?.message ?? error).split("\n")[0];
        console.log(`  proto ${row.id} ${device}: ${result.error}`);
        await page.screenshot({ path: out, fullPage: false }).catch(() => {});
      }
      await page.close();
      writeFileSync(`${out}.json`, JSON.stringify(result));
    }
    await context.close();
  }
}

// Small helpers handed to a row's `run` steps.
function helpers(page) {
  return {
    click: (role, name, opts = {}) => page.getByRole(role, { name, ...opts }).first().click({ timeout: 8000 }),
    text: (text) => page.getByText(text).first().click({ timeout: 8000 }),
    fill: (label, value) => page.getByLabel(label).first().fill(value, { timeout: 8000 }),
    see: (text) => page.getByText(text).first().waitFor({ state: "visible", timeout: 15_000 }),
    wait: (ms) => page.waitForTimeout(ms),
  };
}

// ---- the build side: emulators, fixtures, servers ----
async function ts(path) {
  const { tsImport } = await import("tsx/esm/api");
  return tsImport(path, import.meta.url);
}

let emulators = null;
let loads = 0;
/** The emulator's 1 GB heap fills over many reloads (see the e2e runner's chunks); a fresh one every 20. */
async function restartEmulators() {
  if (!emulators) return;
  const old = emulators;
  emulators = null;
  try {
    process.kill(-old.pid, "SIGINT");
  } catch {}
  await waitFor(async () => !(await portOpen(TEST_PORTS.firestore)) && !(await portOpen(TEST_PORTS.auth)), "the emulators to stop", 60_000);
  await startEmulators();
}

async function startEmulators() {
  for (const port of [TEST_PORTS.firestore, TEST_PORTS.auth]) {
    if (await portOpen(port)) throw new Error(`Port ${port} is taken (an e2e run or an emulator left behind?). Stop that first; this run never reuses a server.`);
  }
  const config = writeEmulatorConfig();
  emulators = start("npx", ["firebase", "emulators:start", "--config", config, "--only", "auth,firestore", "--project", EMULATOR_PROJECT_ID], { JAVA_TOOL_OPTIONS: `-Xmx1g -Djava.util.logging.config.file=${join(ROOT, "tests/e2e/emulator-logging.properties")}` }, "emulators");
  await waitFor(() => portOpen(TEST_PORTS.firestore), "the Firestore emulator", 120_000);
  await waitFor(() => portOpen(TEST_PORTS.auth), "the Auth emulator", 120_000);
}

function build(name, env, distDir) {
  if (noBuild && existsSync(join(ROOT, distDir, "BUILD_ID"))) return;
  console.log(`Building the ${name} app (production, ${distDir})…`);
  // `next build` rewrites tsconfig.json to list its build folder's types; put the file back.
  const tsconfig = readFileSync(join(ROOT, "tsconfig.json"), "utf8");
  const result = spawnSync("npx", ["next", "build"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env, NEXT_DIST_DIR: distDir } });
  writeFileSync(join(ROOT, "tsconfig.json"), tsconfig);
  if (result.status !== 0) throw new Error(`next build failed for the ${name} app`);
}

async function startApp(name, env, distDir, port) {
  if (await portOpen(port)) throw new Error(`Port ${port} is taken.`);
  start("npx", ["next", "start", "--port", String(port)], { ...env, NEXT_DIST_DIR: distDir }, `${name} app`);
  await waitFor(() => httpOk(`http://127.0.0.1:${port}/sign-in`), `the ${name} app`, 120_000);
}

/** A step that must end: a hung one stops the run with its name instead of waiting for ever. */
function timed(label, work, ms = 120_000) {
  let timer;
  const started = Date.now();
  return Promise.race([
    work.finally(() => {
      clearTimeout(timer);
      if (process.env.SHOTS_VERBOSE) console.log(`  ${label}: ${Date.now() - started} ms`);
    }),
    new Promise((_, no) => {
      timer = setTimeout(() => no(new Error(`${label} took longer than ${ms / 1000}s`)), ms);
    }),
  ]);
}

let loaded = null;
async function loadData(key, fixture, patch) {
  if (loaded === key) return;
  loads += 1;
  if (loads % 20 === 0 || fixture === "stress") await restartEmulators();
  const { loadFixture } = await timed("import the fixture loader", ts("../tests/fixtures/load.ts"));
  for (let attempt = 1; ; attempt += 1) {
    try {
      await timed(`load the ${fixture} fixture`, loadFixture(fixture), 900_000);
      break;
    } catch (error) {
      // An overloaded emulator times writes out; a fresh one usually takes the same data.
      if (attempt === 3) throw error;
      console.log(`  loading ${fixture} failed (${String(error.message).split("\n")[0]}); restarting the emulators`);
      await restartEmulators();
    }
  }
  if (patch) {
    const patches = await timed("import the patches", ts("../tests/screenshots/patches.ts"));
    await timed(`apply the ${patch} patch`, patches.apply(patch));
  }
  loaded = key;
}

async function signIn(page, base, account = TEST_ACCOUNTS[0]) {
  await page.goto(`${base}/sign-in`);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${base}/`, { timeout: 60_000 });
}

async function waitReady(page, row) {
  const main = page.locator("main").first();
  await main.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
  if (!/loading/.test(row.build.fault ?? "")) {
    await page.locator("[aria-busy=true]").first().waitFor({ state: "detached", timeout: 20_000 }).catch(() => {});
  }
  await settle(page, 700);
}

const built = (row, device) => {
  const result = readJson(`${shot("build", row, device)}.json`);
  return Boolean(result) && !result.error && existsSync(shot("build", row, device));
};

function captureBuild(context, base, device, row) {
  if (resume && built(row, device)) return Promise.resolve();
  return timed(`${row.id} ${device}`, captureOne(context, base, device, row), 150_000).catch((error) => {
    const out = shot("build", row, device);
    console.log(`  build ${row.id} ${device}: ${error.message}`);
    writeFileSync(`${out}.json`, JSON.stringify({ row: row.id, device, side: "build", error: error.message }));
  });
}

async function captureOne(context, base, device, row) {
  const out = shot("build", row, device);
  const result = { row: row.id, device, side: "build" };
  const page = await context.newPage();
  try {
    const fault = row.build.fault ? `${row.build.path.includes("?") ? "&" : "?"}fault=${row.build.fault}` : "";
    const tools = { ...helpers(page), base, device, context, patch: async (name) => timed(`apply the ${name} patch`, (await ts("../tests/screenshots/patches.ts")).apply(name)) };
    if (row.build.before) await row.build.before(page, tools);
    await page.goto(`${base}${row.build.path}${fault}`, { waitUntil: "load" });
    await waitReady(page, row);
    if (row.build.run) {
      await row.build.run(page, tools);
      await settle(page, 400);
    }
    Object.assign(result, await take(page, device, out, row.build.fixture === "stress"));
  } catch (error) {
    result.error = String(error?.message ?? error).split("\n")[0];
    console.log(`  build ${row.id} ${device}: ${result.error}`);
    await page.screenshot({ path: out, fullPage: false }).catch(() => {});
  }
  await page.close().catch(() => {});
  writeFileSync(`${out}.json`, JSON.stringify(result));
}

async function signedInContext(browser, device, base) {
  const context = await newContext(browser, device);
  const page = await context.newPage();
  await signIn(page, base).catch((e) => console.log(`  sign-in failed: ${e.message.split("\n")[0]}`));
  await page.close();
  return context;
}

async function buildShots(browser, allRows) {
  const rows = resume ? allRows.filter((r) => devices.some((d) => !built(r, d))) : allRows;
  // Rows are grouped by the data they need, so a fixture loads once; a row that writes data gets a fresh load.
  const keyOf = (r) => `${r.build.fixture}${r.build.patch ? `+${r.build.patch}` : ""}`;
  const base = `http://127.0.0.1:${APP_PORT}`;
  for (const key of [...new Set(rows.map(keyOf))]) {
    const set = rows.filter((r) => keyOf(r) === key);
    const clean = set.filter((r) => r.build.app === "emulator" && !r.build.dirty);
    const dirty = set.filter((r) => r.build.app === "emulator" && r.build.dirty);
    const demo = set.filter((r) => r.build.app === "demo");
    for (const device of devices) {
      if (resume && set.every((r) => built(r, device))) continue;
      if (clean.length) {
        await loadData(key, set[0].build.fixture, set[0].build.patch);
        const authed = await signedInContext(browser, device, base);
        for (const row of clean) {
          if (row.build.signedOut) {
            const fresh = await newContext(browser, device);
            await captureBuild(fresh, base, device, row);
            await fresh.close();
          } else await captureBuild(authed, base, device, row);
        }
        await authed.close();
      }
      for (const row of dirty) {
        loaded = null;
        await loadData(key, set[0].build.fixture, set[0].build.patch);
        const context = row.build.signedOut ? await newContext(browser, device) : await signedInContext(browser, device, base);
        await captureBuild(context, base, device, row);
        await context.close();
        loaded = null;
      }
      if (demo.length) await demoShots(browser, device, demo);
    }
  }
}

async function demoShots(browser, device, rows) {
  const context = await newContext(browser, device);
  const base = `http://127.0.0.1:${DEMO_PORT}`;
  for (const row of rows) {
    const out = shot("build", row, device);
    const result = { row: row.id, device, side: "build" };
    const page = await context.newPage();
    // Demonstration mode opens through "Look around", which the tab remembers.
    if (row.group.slug !== "sign-in") await page.addInitScript(() => sessionStorage.setItem("veil.lookAround", "1"));
    try {
      const fault = row.build.fault ? `${row.build.path.includes("?") ? "&" : "?"}fault=${row.build.fault}` : "";
      await page.goto(`${base}${row.build.path}${fault}`, { waitUntil: "load" });
      await waitReady(page, row);
      if (row.build.run) {
        await row.build.run(page, { ...helpers(page), base, device, context });
        await settle(page, 400);
      }
      Object.assign(result, await take(page, device, out));
    } catch (error) {
      result.error = String(error?.message ?? error).split("\n")[0];
      console.log(`  build ${row.id} ${device}: ${result.error}`);
      await page.screenshot({ path: out, fullPage: false }).catch(() => {});
    }
    await page.close().catch(() => {});
    writeFileSync(`${out}.json`, JSON.stringify(result));
  }
  await context.close();
}

// ---- comparison and the report ----
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
};

async function raw(path, width) {
  const { data, info } = await sharp(path).removeAlpha().resize({ width, withoutEnlargement: false }).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function compare(row, device) {
  const a = shot("proto", row, device);
  const b = shot("build", row, device);
  if (!existsSync(a) || !existsSync(b)) return null;
  const width = SIZES[device].width;
  const A = await raw(a, width);
  const B = await raw(b, width);
  const height = Math.max(A.height, B.height);
  const diff = Buffer.alloc(width * height * 3, 255);
  let differing = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      const inA = y < A.height;
      const inB = y < B.height;
      let d = 255;
      if (inA && inB) d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
      if (d > 24) {
        differing += 1;
        diff[i] = 230;
        diff[i + 1] = 40;
        diff[i + 2] = 80;
      } else if (inA) {
        for (let c = 0; c < 3; c += 1) diff[i + c] = Math.round(255 - (255 - A.data[i + c]) * 0.18);
      }
    }
  }
  const pad = async (img) =>
    sharp(img.data, { raw: { width, height: img.height, channels: 3 } })
      .extend({ bottom: height - img.height, background: "#ffffff" })
      .png()
      .toBuffer();
  const gap = 16;
  const sheet = await sharp({ create: { width: width * 3 + gap * 2, height, channels: 3, background: "#8a8a8a" } })
    .composite([
      { input: await pad(A), left: 0, top: 0 },
      { input: await pad(B), left: width + gap, top: 0 },
      { input: await sharp(diff, { raw: { width, height, channels: 3 } }).png().toBuffer(), left: (width + gap) * 2, top: 0 },
    ])
    .png()
    .toBuffer();
  await sharp(sheet).toFile(join(dir("pairs"), `${row.id}--${device}.png`));
  return { diff: differing / (width * height), protoHeight: A.height, buildHeight: B.height };
}

const pct = (n) => `${(n * 100).toFixed(1)}%`;

async function report() {
  const results = {};
  for (const row of all) {
    if (row.skip) {
      results[row.id] = { skip: row.skip };
      continue;
    }
    const entry = {};
    for (const device of Object.keys(SIZES)) {
      const p = readJson(`${shot("proto", row, device)}.json`);
      const b = readJson(`${shot("build", row, device)}.json`);
      if (!p && !b) continue;
      const cache = join(dir("pairs"), `${row.id}--${device}.json`);
      const c = picked.includes(row) && devices.includes(device) ? await compare(row, device) : readJson(cache);
      entry[device] = { ...(c ?? {}), protoError: p?.error, buildError: b?.error };
      if (c) writeFileSync(join(dir("pairs"), `${row.id}--${device}.json`), JSON.stringify(c));
    }
    results[row.id] = entry;
  }
  writeFileSync(join(REPORT, "report.json"), JSON.stringify(results, null, 2));

  const lines = ["# Screenshot comparison", "", `Prototype vs build, light, 390px and 1440px, clock fixed at ${TODAY}. Generated ${new Date().toISOString()}.`, "", "Difference = share of pixels whose colour differs by more than 24 in a channel, with the shorter image padded; images taller than the cap (phone 5000px, desktop 4000px) are cut off in both. Pairs are in `pairs/` (prototype | build | difference).", ""];
  const groupRows = new Map();
  for (const row of all) groupRows.set(row.group.slug, [...(groupRows.get(row.group.slug) ?? []), row]);
  lines.push("## By group", "", "| Group | Rows | Compared | Not captured | Skipped | Mean difference | Over 5% | Over 15% |", "|---|---|---|---|---|---|---|---|");
  const detail = [];
  for (const rows of groupRows.values()) {
    let compared = 0;
    let failed = 0;
    let skipped = 0;
    let sum = 0;
    let n = 0;
    let over5 = 0;
    let over15 = 0;
    const out = [];
    for (const row of rows) {
      const r = results[row.id];
      if (r.skip) {
        skipped += 1;
        out.push(`| ${row.label} | skipped | | ${r.skip} |`);
        continue;
      }
      const cells = [];
      let any = false;
      let note = [];
      for (const device of Object.keys(SIZES)) {
        const d = r[device];
        if (!d) {
          cells.push("not run");
          continue;
        }
        if (d.diff === undefined) {
          cells.push("no pair");
          failed += 1;
          note.push(`${device}: ${[d.protoError && `prototype: ${d.protoError}`, d.buildError && `build: ${d.buildError}`].filter(Boolean).join("; ") || "missing shot"}`);
          continue;
        }
        any = true;
        cells.push(`${pct(d.diff)}${d.protoHeight !== d.buildHeight ? ` (h ${d.protoHeight}→${d.buildHeight})` : ""}`);
        sum += d.diff;
        n += 1;
        if (d.diff > 0.05) over5 += 1;
        if (d.diff > 0.15) over15 += 1;
        if (d.buildError) note.push(`${device}: build step failed (${d.buildError})`);
      }
      if (any) compared += 1;
      out.push(`| ${row.label} | ${cells[0]} | ${cells[1]} | ${note.join(" · ")} |`);
    }
    lines.push(`| ${rows[0].group.title} | ${rows.length} | ${compared} | ${failed} | ${skipped} | ${n ? pct(sum / n) : "-"} | ${over5} | ${over15} |`);
    detail.push(`### ${rows[0].group.title}`, "", "| Row | Phone | Desktop | Notes |", "|---|---|---|---|", ...out, "");
  }
  lines.push("", "## Every row", "", ...detail);
  writeFileSync(join(REPORT, "report.md"), `${lines.join("\n")}\n`);
  console.log(`Report: ${join(REPORT, "report.md")}`);
}

// ---- the accessibility report (--axe) ----
function axeReport() {
  const byRule = new Map();
  let checked = 0;
  const failed = [];
  for (const row of picked) {
    if (row.skip) continue;
    for (const device of devices) {
      const r = readJson(`${shot("build", row, device)}.json`);
      if (!r) continue;
      if (r.error || !r.violations) {
        failed.push(`${row.id} ${device}: ${r?.error ?? "no result"}`);
        continue;
      }
      checked += 1;
      for (const v of r.violations) {
        const entry = byRule.get(v.id) ?? { help: v.help, impact: v.impact, rows: new Set(), nodes: new Map() };
        entry.rows.add(`${row.id} (${device})`);
        for (const n of v.nodes) {
          const node = entry.nodes.get(n.target) ?? { ...n, rows: [] };
          entry.nodes.set(n.target, node);
          if (node.rows.length < 3) node.rows.push(row.id);
        }
        byRule.set(v.id, entry);
      }
    }
  }
  const lines = ["# Accessibility scan (axe, WCAG 2.2 A and AA)", "", `${checked} row × size states scanned; ${byRule.size} rules with violations. Generated ${new Date().toISOString()}.`, ""];
  if (failed.length) lines.push("## Not scanned", "", ...failed.map((f) => `- ${f}`), "");
  for (const [id, e] of [...byRule].sort((a, b) => b[1].rows.size - a[1].rows.size)) {
    lines.push(`## ${id} (${e.impact}): ${e.help}`, "", `${e.rows.size} states, ${e.nodes.size} distinct elements.`, "");
    for (const n of [...e.nodes.values()].slice(0, 8)) lines.push(`- \`${n.target}\` in ${n.rows.join(", ")}: ${n.why ?? ""}  \n  \`${n.html.replace(/\n/g, " ")}\``);
    lines.push("");
  }
  const smalls = new Map();
  for (const row of picked) {
    for (const device of devices) {
      for (const c of readJson(`${shot("build", row, device)}.json`)?.small ?? []) {
        const key = `${c.tag}.${c.cls}`;
        const e = smalls.get(key) ?? { n: 0, w: 999, h: 999, label: c.label, rows: new Set() };
        e.n += 1;
        e.w = Math.min(e.w, c.w);
        e.h = Math.min(e.h, c.h);
        e.rows.add(row.id);
        smalls.set(key, e);
      }
    }
  }
  lines.push("## Controls under 34px (guide §8 asks 34px for pills, toolbar buttons, stars, ticks and steppers; 24px for the task tick, step boxes and the ×)", "");
  for (const [key, e] of [...smalls].sort((a, b) => a[1].h - b[1].h)) lines.push(`- \`${key}\` min ${e.w}×${e.h}, ${e.n} seen, e.g. "${e.label}" in ${[...e.rows].slice(0, 2).join(", ")}`);
  lines.push("");
  writeFileSync(join(REPORT, "axe.md"), `${lines.join("\n")}\n`);
  console.log(`Axe report: ${join(REPORT, "axe.md")} (${checked} scanned, ${failed.length} not scanned, ${byRule.size} rules with violations)`);
}

// ---- main ----
const runnable = picked.filter((r) => !r.skip);
const needBuild = side !== "proto" && runnable.length > 0;
let browser;
let proto;
try {
  mkdirSync(REPORT, { recursive: true });
  proto = await serveProto();
  const emulatorRows = runnable.filter((r) => r.build.app === "emulator");
  const demoRows = runnable.filter((r) => r.build.app === "demo");
  if (needBuild) {
    if (emulatorRows.length) {
      build("emulator", EMULATOR_APP_ENV, ".next-shots");
    }
    if (demoRows.length) build("demo", DEMO_APP_ENV, ".next-shots-demo");
    if (emulatorRows.length) {
      await startEmulators();
      await startApp("emulator", EMULATOR_APP_ENV, ".next-shots", APP_PORT);
    }
    if (demoRows.length) await startApp("demo", DEMO_APP_ENV, ".next-shots-demo", DEMO_PORT);
  }
  browser = await chromium.launch();
  if (side !== "build") {
    console.log(`Prototype: ${runnable.length} rows…`);
    await protoShots(browser, runnable);
  }
  if (needBuild) {
    console.log(`Build: ${runnable.length} rows…`);
    try {
      await buildShots(browser, runnable);
    } catch (error) {
      console.log(`The build pass stopped: ${error.message}\nRerun with --resume to carry on. Writing the report for what exists.`);
      process.exitCode = 1;
    }
  }
  await (axe ? axeReport() : report());
} finally {
  await browser?.close().catch(() => {});
  proto?.close();
  stopAll();
}
setTimeout(() => process.exit(0), 9000).unref();
