import { describe, expect, it } from "vitest";
import { msUntilMidnight } from "@/lib/data/use-today";

// Task 4.3: the day moves on at local midnight, so a screen left open overnight
// counts from the new day. The timer waits a second past midnight so it never
// fires while the old day is still on the clock.

describe("msUntilMidnight", () => {
  it("counts to the next local midnight, plus a second", () => {
    expect(msUntilMidnight(new Date(2026, 9, 14, 23, 59, 30))).toBe(31_000);
  });

  it("counts a whole day from the start of a day", () => {
    expect(msUntilMidnight(new Date(2026, 9, 15, 0, 0, 0))).toBe(86_401_000);
  });
});
