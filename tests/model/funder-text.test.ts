import { describe, expect, it } from "vitest";
import {
  metaParts,
  paidShare,
  removeBody,
  removeTitle,
  restText,
  threadLabel,
  totalsNote,
} from "@/veil/screens/who-pays/funder-text";

describe("Who pays: the words", () => {
  it("works out the share paid, kept within the track", () => {
    expect(paidShare({ price: 200, paid: 54 })).toBe(27);
    expect(paidShare({ price: 0, paid: 0 })).toBe(0);
    expect(paidShare({ price: 100, paid: 250 })).toBe(100);
    expect(paidShare({ price: 100, paid: -5 })).toBe(0);
    expect(threadLabel({ price: 1000, paid: 540 })).toBe("54% paid");
  });

  it("says what a row holds, or why it holds nothing", () => {
    expect(metaParts({ id: "g", count: 2, paid: 5_000_000, price: 12_500_000 })).toEqual({
      kind: "paid",
      paid: "Rp 5.000.000",
      price: "Rp 12.500.000",
    });
    expect(metaParts({ id: "g", count: 0, paid: 0, price: 0 })).toEqual({ kind: "none", text: "Nothing assigned yet" });
    expect(metaParts({ id: null, count: 0, paid: 0, price: 0 })).toEqual({ kind: "none", text: "Every cost has a funder" });
  });

  it("shows still to pay, or the amount over in rose as a positive number", () => {
    expect(restText({ left: 7_500_000 })).toEqual({ text: "Rp 7.500.000", over: false });
    expect(restText({ left: 0 })).toEqual({ text: "Rp 0", over: false });
    expect(restText({ left: -1_250_000 })).toEqual({ text: "Rp 1.250.000 overpaid", over: true });
  });

  it("names what moves, what stays and the undo window when removing", () => {
    expect(removeTitle("Greg")).toBe("Remove Greg?");
    expect(removeBody({ count: 3, price: 30_000_000 })).toBe(
      "3 costs (Rp 30.000.000) will move to Not assigned. Payments already recorded stay as they are. You can undo for a few seconds.",
    );
    expect(removeBody({ count: 1, price: 5_000_000 })).toMatch(/^1 cost \(Rp 5\.000\.000\) will move/);
    expect(removeBody({ count: 0, price: 0 })).toBe("Nothing is assigned to them. You can undo for a few seconds.");
  });

  it("counts the what-if items that move to Not assigned with the funder", () => {
    expect(removeBody({ count: 3, price: 30_000_000 }, 2)).toBe(
      "3 costs (Rp 30.000.000) will move to Not assigned, and so will 2 what-if items. Payments already recorded stay as they are. You can undo for a few seconds.",
    );
    expect(removeBody({ count: 0, price: 0 }, 1)).toBe("1 what-if item will move to Not assigned. You can undo for a few seconds.");
  });

  it("writes the closing totals with a true minus when the budget is over", () => {
    expect(totalsNote(10_000_000, 2_500_000)).toEqual({ paid: "Rp 10.000.000", left: "Rp 2.500.000" });
    expect(totalsNote(10, -5)).toEqual({ paid: "Rp 10", left: "−Rp 5" });
  });
});
