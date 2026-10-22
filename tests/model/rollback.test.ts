import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// Phase 7 review: the one-commit way back (plan §9.3) must keep applying until
// Phase 9 removes the fallback. A task that adds a page at the root, or edits
// a file the switch moved in a way that conflicts, fails here first.
describe("the way back", () => {
  it("reverts the switch-over cleanly on this branch", () => {
    const out = execFileSync("node", ["scripts/rollback.mjs"], { encoding: "utf8" });
    expect(out).toContain("Check passed");
  });
});
