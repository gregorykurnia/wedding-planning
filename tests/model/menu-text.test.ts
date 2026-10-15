import { describe, expect, it } from "vitest";
import type { Part } from "@/lib/model/bookings";
import { moreFunders, moreParts, partLineList, partLineValue, partStatus } from "@/veil/parts/menu-card/menu-text";

// Task 3.6: the words and tones of parts, from guide §4.8. Today is 14 October 2026.

const TODAY = "2026-10-14";

const part = (over: Partial<Part> & Pick<Part, "id" | "name">): Part => ({
  price: 25_000_000,
  paid: 0,
  funder: null,
  due: null,
  step: "",
  ...over,
});

describe("partLineValue (a ledger line)", () => {
  it("shows what's left and the date, plainly, while the date is ahead", () => {
    const p = part({ id: "f", name: "Final", price: 30_000_000, paid: 10_000_000, due: "2026-10-30" });
    expect(partLineValue(p, TODAY)).toEqual({ value: "Rp 20.000.000, 30 Oct", tone: "plain" });
  });

  it("says 'was due' in rose once the date has passed", () => {
    const p = part({ id: "b", name: "Balance", due: "2026-10-10" });
    expect(partLineValue(p, TODAY)).toEqual({ value: "Rp 25.000.000, was due 10 Oct", tone: "late" });
  });

  it("treats a part due today as due, not late", () => {
    const p = part({ id: "t", name: "Today", due: "2026-10-14" });
    expect(partLineValue(p, TODAY)).toEqual({ value: "Rp 25.000.000, 14 Oct", tone: "plain" });
  });

  it("says 'no date' for a part without one", () => {
    const p = part({ id: "x", name: "Extra", price: 5_000_000 });
    expect(partLineValue(p, TODAY)).toEqual({ value: "Rp 5.000.000, no date", tone: "plain" });
  });

  it("says 'paid' in sage for a part paid in full, whatever its date", () => {
    const p = part({ id: "d", name: "Deposit", price: 25_000_000, paid: 25_000_000, due: "2026-09-01" });
    expect(partLineValue(p, TODAY)).toEqual({ value: "paid Rp 25.000.000", tone: "done" });
  });

  it("says overpaid by how much in rose, and an overpaid part with a date is still overpaid", () => {
    const p = part({ id: "o", name: "Top-up", price: 1_000_000, paid: 2_000_000, due: "2026-10-30" });
    expect(partLineValue(p, TODAY)).toEqual({ value: "overpaid by Rp 1.000.000", tone: "late" });
  });

  it("keeps thirteen-digit amounts whole", () => {
    const p = part({ id: "big", name: "Venue", price: 1_234_567_890_123 });
    expect(partLineValue(p, TODAY).value).toBe("Rp 1.234.567.890.123, no date");
  });
});

describe("partStatus (a part's summary on a booking)", () => {
  it("reads due with the date, and late with the days", () => {
    expect(partStatus(part({ id: "f", name: "Final", price: 30_000_000, paid: 10_000_000, due: "2026-10-30" }), TODAY)).toEqual({
      value: "Rp 20.000.000 due 30 Oct",
      tone: "plain",
    });
    expect(partStatus(part({ id: "b", name: "Balance", due: "2026-10-10" }), TODAY)).toEqual({
      value: "Rp 25.000.000 4 days late",
      tone: "late",
    });
  });

  it("reads paid in full in sage, overpaid in rose, and no date as to pay", () => {
    expect(partStatus(part({ id: "d", name: "Deposit", paid: 25_000_000 }), TODAY)).toEqual({ value: "paid in full", tone: "done" });
    expect(partStatus(part({ id: "o", name: "Top-up", price: 1_000_000, paid: 2_000_000 }), TODAY)).toEqual({
      value: "overpaid by Rp 1.000.000",
      tone: "late",
    });
    expect(partStatus(part({ id: "x", name: "Extra", price: 5_000_000 }), TODAY)).toEqual({
      value: "Rp 5.000.000 to pay, no date",
      tone: "plain",
    });
  });
});

describe("partLineList (collapsing a long list)", () => {
  const many = (count: number, owing: (i: number) => boolean) =>
    Array.from({ length: count }, (_, i) =>
      part({ id: `p${i}`, name: `Part ${i + 1}`, price: 1_000_000, paid: owing(i) ? 0 : 1_000_000, due: "2026-11-01" }),
    );

  it("shows up to five parts as they are, with nothing left out", () => {
    const list = partLineList(many(5, () => true), TODAY);
    expect(list.more).toBe(0);
    expect(list.lines.map((line) => line.key)).toEqual(["p0", "p1", "p2", "p3", "p4"]);
  });

  it("past five, shows the first four still owing in their order, and counts the rest", () => {
    // Parts 1, 3 and 5 are paid; the seven owing parts are 2, 4, 6, 7, 8, 9 and 10.
    const parts = many(10, (i) => ![0, 2, 4].includes(i));
    const list = partLineList(parts, TODAY);
    expect(list.lines.map((line) => line.name)).toEqual(["Part 2", "Part 4", "Part 6", "Part 7"]);
    expect(list.more).toBe(6);
  });

  it("keys a booking with no parts by its place", () => {
    const list = partLineList([part({ id: null, name: "Vendor" })], TODAY);
    expect(list.lines).toEqual([{ key: "line-0", name: "Vendor", value: "Rp 25.000.000, no date", tone: "plain" }]);
  });

  it("is empty for no parts", () => {
    expect(partLineList([], TODAY)).toEqual({ lines: [], more: 0 });
  });
});

describe("the 'more' lines", () => {
  it("count parts and funders, in the singular for one", () => {
    expect(moreParts(36)).toBe("and 36 more parts");
    expect(moreParts(1)).toBe("and 1 more part");
    expect(moreFunders(3)).toBe("and 3 more funders");
    expect(moreFunders(1)).toBe("and 1 more funder");
  });
});
