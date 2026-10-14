import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALLOWED_EMAILS } from "@/lib/server/allowlist";

describe("server allowlist", () => {
  it("matches the addresses in firestore.rules", () => {
    const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
    const list = /request\.auth\.token\.email in \[([^\]]*)\]/.exec(rules)?.[1] ?? "";
    const inRules = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(inRules.length).toBeGreaterThan(0);
    expect([...ALLOWED_EMAILS].sort()).toEqual(inRules.sort());
  });
});
