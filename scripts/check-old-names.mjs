// Old-names check for the new UI (redesign plan Task 6.7), run before every commit.
// Fails when a term from scripts/old-names.txt appears in the new UI's files: an
// old component or file name, an old style name or old wording. A term matches
// anywhere in a line, exactly and case-sensitively, so "AppShell" also catches
// "AppShellProps", while "Our wedding planner" (the new name) is not "Our Wedding".
// Run from the repo root:
//   node scripts/check-old-names.mjs                    the new UI's four roots
//   node scripts/check-old-names.mjs src                other roots instead
//   node scripts/check-old-names.mjs --exclude 'src/app/(legacy)/**'
// --exclude takes a glob for paths relative to the current directory and can repeat.
// Exits 1 and lists each hit on its own line; exits 2 when a root or option is wrong.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOTS = ["src/veil", "src/app/(veil)", "src/lib/model", "src/lib/data"];
const TEXT_FILE = /\.(?:css|html|json|jsx?|md|mjs|cjs|svg|tsx?)$/;
const TERMS_FILE = fileURLToPath(new URL("./old-names.txt", import.meta.url));

function fail(message, code) {
  console.error(message);
  process.exit(code);
}

// "**/" matches any number of folders, "**" anything, "*" one name, "?" one character.
function globToRegExp(glob) {
  let pattern = "";
  for (let i = 0; i < glob.length; i++) {
    if (glob.startsWith("**/", i)) {
      pattern += "(?:.*/)?";
      i += 2;
    } else if (glob.startsWith("**", i)) {
      pattern += ".*";
      i += 1;
    } else if (glob[i] === "*") {
      pattern += "[^/]*";
    } else if (glob[i] === "?") {
      pattern += "[^/]";
    } else {
      pattern += glob[i].replace(/[\\^$.|+()[\]{}]/g, "\\$&");
    }
  }
  return new RegExp(`^${pattern}$`);
}

function parseArgs(argv) {
  const roots = [];
  const excludes = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--exclude") {
      if (argv[i + 1] === undefined) fail("--exclude needs a glob.", 2);
      excludes.push(argv[++i]);
    } else if (arg.startsWith("--exclude=")) {
      excludes.push(arg.slice("--exclude=".length));
    } else if (arg.startsWith("-")) {
      fail(`Unknown option ${arg}`, 2);
    } else {
      roots.push(arg);
    }
  }
  return {
    roots: roots.length > 0 ? roots : DEFAULT_ROOTS,
    excludes: excludes.map(globToRegExp),
  };
}

function* textFiles(path) {
  if (statSync(path).isFile()) {
    yield path;
    return;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) yield* textFiles(child);
    else if (TEXT_FILE.test(entry.name)) yield child;
  }
}

const terms = readFileSync(TERMS_FILE, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line !== "" && !line.startsWith("#"));

const { roots, excludes } = parseArgs(process.argv.slice(2));
const missing = roots.filter((root) => !existsSync(root));
if (missing.length > 0) fail(`Root not found: ${missing.join(", ")}`, 2);

const problems = [];
let checked = 0;
for (const root of roots) {
  for (const file of textFiles(root)) {
    const path = relative(process.cwd(), file).split(sep).join("/");
    if (excludes.some((pattern) => pattern.test(path))) continue;
    checked++;
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        for (const term of terms) {
          if (line.includes(term)) {
            problems.push(`${path}:${index + 1}: found "${term}": ${line.trim()}`);
          }
        }
      });
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`Old-names check failed: ${problems.length} problem(s).`);
  process.exitCode = 1;
} else {
  console.log(`Old-names check passed: ${checked} file(s) and ${terms.length} term(s), no old names.`);
}
