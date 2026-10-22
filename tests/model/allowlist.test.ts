import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALLOWED_EMAILS } from "@/lib/server/allowlist";

describe("server allowlist", () => {
  const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
  const list = /request\.auth\.token\.email in \[([^\]]*)\]/.exec(rules)?.[1];

  it("matches the addresses in firestore.rules, when the rules list any", () => {
    if (list === undefined) {
      // Open access (2026-10-22): any signed-in account, anonymous ones included.
      expect(rules).toMatch(/function isAllowed\(\) \{\s*return request\.auth != null;\s*\}/);
      return;
    }
    const inRules = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(inRules.length).toBeGreaterThan(0);
    expect([...ALLOWED_EMAILS].sort()).toEqual(inRules.sort());
  });
});
