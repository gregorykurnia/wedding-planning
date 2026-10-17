import { describe, expect, it } from "vitest";
import { countdown } from "@/lib/model/countdown";

// Task 4.3: the budget's closing line (guide §5.4, N7). Today is 14 October
// 2026, the day the design's examples are written for: 157 days until
// Saturday 20 March 2027.
const TODAY = "2026-10-14";

describe("countdown", () => {
  it("has no phase without a wedding date", () => {
    expect(countdown(null, TODAY)).toBeNull();
  });

  it("counts the days until the wedding", () => {
    expect(countdown("2027-03-20", TODAY)).toEqual({ phase: "before", days: 157 });
  });

  it("says tomorrow the day before", () => {
    expect(countdown("2026-10-15", TODAY)).toEqual({ phase: "eve" });
  });

  it("says the wedding is today on the day", () => {
    expect(countdown(TODAY, TODAY)).toEqual({ phase: "day" });
  });

  it("ends the count after the day", () => {
    expect(countdown("2026-10-02", TODAY)).toEqual({ phase: "after" });
  });
});
