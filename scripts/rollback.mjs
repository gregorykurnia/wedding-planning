#!/usr/bin/env node
// The one-commit way back (plan §9.3): revert "Switch to the new UI" so the old
// UI serves / again and the new one /new.
//
//   node scripts/rollback.mjs            check only: changes nothing
//   node scripts/rollback.mjs --apply    revert on the current branch (never pushes)
//
// Files deleted after the switch (Task 7.3's old pages) make the revert stop on
// rename/delete conflicts; they stay deleted, which is what the fallback had.
// Any other conflict, or a page the revert would leave outside /new or /old,
// stops the script before anything is written.
import { execFileSync } from "node:child_process";

const apply = process.argv.includes("--apply");
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const gitTry = (...args) => {
  try {
    return { ok: true, out: git(...args) };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() };
  }
};

const switches = git("log", "--format=%H", "--fixed-strings", "--grep=Switch to the new UI", "HEAD")
  .split("\n")
  .filter((hash) => hash && git("log", "-1", "--format=%s", hash) === "Switch to the new UI");
if (switches.length !== 1) {
  console.error(`Expected one commit titled "Switch to the new UI" on HEAD, found ${switches.length}.`);
  process.exit(1);
}
const [hash] = switches;

// A revert of `hash` is a merge of hash^ into HEAD with `hash` as the base.
const merge = gitTry("merge-tree", "--write-tree", "--merge-base", hash, "HEAD", `${hash}^`);
const lines = merge.out.split("\n");
const tree = lines[0];
const deletedLater = [];
const problems = [];
for (const line of lines.filter((l) => l.startsWith("CONFLICT ("))) {
  const renamed = line.match(/^CONFLICT \(rename\/delete\): .+ renamed to (.+) in .+, but deleted in HEAD\.$/);
  const modified = line.match(/^CONFLICT \(modify\/delete\): (.+) deleted in HEAD and modified in /);
  if (renamed) deletedLater.push(renamed[1]);
  else if (modified) deletedLater.push(modified[1]);
  else problems.push(line);
}
if (!merge.ok && deletedLater.length === 0 && problems.length === 0) {
  problems.push(merge.out || "git merge-tree failed");
}

// After the revert every new-UI page sits under (veil)/new and nothing under
// (legacy)/old: a page added at the root after the switch would answer next to
// the old UI (or clash with it) and fail the build.
if (/^[0-9a-f]{40}$/.test(tree)) {
  const paths = git("ls-tree", "-r", "--name-only", tree, "--", "src/app").split("\n");
  for (const path of paths) {
    const dropped = deletedLater.includes(path);
    if (path.startsWith("src/app/(veil)/") && !path.startsWith("src/app/(veil)/new/") && !dropped) {
      problems.push(`left outside /new after the revert: ${path}`);
    }
    if (path.startsWith("src/app/(legacy)/old/") && !dropped) {
      problems.push(`left under /old after the revert: ${path}`);
    }
  }
}

console.log(`Switch commit: ${hash}`);
for (const path of deletedLater) console.log(`  stays deleted (removed after the switch): ${path}`);
if (problems.length > 0) {
  console.error("The revert needs a hand; nothing was changed:");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
if (!apply) {
  console.log("Check passed: the revert applies. Run again with --apply to make it, then build and push.");
  process.exit(0);
}

if (git("status", "--porcelain") !== "") {
  console.error("The working tree has changes; commit or stash them first.");
  process.exit(1);
}
const revert = gitTry("revert", "--no-edit", hash);
if (!revert.ok) {
  console.log("Stopped on the expected conflicts; keeping those files deleted.");
  for (const path of deletedLater) gitTry("rm", "--quiet", "--", path);
  const unresolved = git("diff", "--name-only", "--diff-filter=U");
  if (unresolved !== "") {
    gitTry("revert", "--abort");
    console.error(`Unexpected conflicts, revert aborted:\n${unresolved}`);
    process.exit(1);
  }
  execFileSync("git", ["-c", "core.editor=true", "revert", "--continue"], { stdio: "inherit" });
}
console.log(`Reverted: ${git("log", "-1", "--format=%h %s")}`);
console.log("Next: npm run build, then push this branch (main deploys the old UI at / and the new at /new).");
