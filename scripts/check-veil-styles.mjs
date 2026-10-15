// Style check for the new UI (redesign plan §2.5), run before every commit.
// 1. src/veil/styles/tokens.css is byte-identical to the frozen
//    redesign/design/tokens.css.
// 2. No raw colours (hex, rgb(), hsl(), oklch() and the like, or %23 hex in an
//    SVG data URL) in the new UI's files, apart from tokens.css itself and the
//    four brand colours in BRAND_COLOURS.
// Exits 1 and lists each problem on its own line.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const frozen = join(root, "redesign/design/tokens.css");
const copy = join(root, "src/veil/styles/tokens.css");
const scanned = ["src/veil", "src/app/(veil)"].map((dir) => join(root, dir));

const HEX = "(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![0-9a-z_-])";
const RAW_COLOUR = [
  new RegExp(`#${HEX}`, "i"),
  /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i,
  new RegExp(`%23${HEX}`, "i"),
];

// Google's "G" keeps Google's four brand colours: its brand guidelines require
// them, and no token stands for them. Only these exact values, and only in this
// file, are allowed; an 8-digit variant of one still fails.
const BRAND_COLOURS = {
  "src/veil/icons/google-mark.tsx": ["#4285F4", "#34A853", "#FBBC05", "#EA4335"],
};

function* sourceFiles(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.(?:css|tsx?|jsx?)$/.test(entry.name)) yield path;
  }
}

const problems = [];

const sameTokens =
  existsSync(copy) && existsSync(frozen) && readFileSync(copy).equals(readFileSync(frozen));
if (!sameTokens) {
  problems.push(`${relative(root, copy)} must be byte-identical to ${relative(root, frozen)}`);
}

for (const dir of scanned) {
  for (const file of sourceFiles(dir)) {
    if (file === copy) continue;
    const brand = BRAND_COLOURS[relative(root, file)] ?? [];
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        const rest = brand.reduce(
          (text, colour) => text.replace(new RegExp(`${colour}(?![0-9a-z_-])`, "gi"), ""),
          line,
        );
        if (RAW_COLOUR.some((pattern) => pattern.test(rest))) {
          problems.push(`${relative(root, file)}:${index + 1}: ${line.trim()}`);
        }
      });
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`Style check failed: ${problems.length} problem(s).`);
  process.exitCode = 1;
} else {
  console.log("Style check passed: tokens.css is identical and no raw colours outside it.");
}
