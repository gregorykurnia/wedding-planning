import { describe, expect, it } from "vitest";
import { readAmount } from "@/lib/model/amount";

// Task 3.4: what a money field makes of what was typed.

describe("readAmount", () => {
  it("reads the ways an amount is typed", () => {
    expect(readAmount("Rp 12.500.000")).toBe(12_500_000);
    expect(readAmount("12500000")).toBe(12_500_000);
    expect(readAmount("  Rp 75.000.000 ")).toBe(75_000_000);
    expect(readAmount("45,000,000")).toBe(45_000_000);
    expect(readAmount("0")).toBe(0);
  });

  it("rounds to whole rupiah", () => {
    expect(readAmount("2,6")).toBe(3);
    expect(readAmount("1.5")).toBe(2);
  });

  it("reads a blank field, or just Rp, as no amount", () => {
    expect(readAmount("")).toBeNull();
    expect(readAmount("   ")).toBeNull();
    expect(readAmount("Rp")).toBeNull();
    expect(readAmount("Rp ")).toBeNull();
  });

  it("refuses what a booking can't hold", () => {
    expect(readAmount("a lot")).toBeUndefined();
    expect(readAmount("12 juta")).toBeUndefined();
    expect(readAmount("-5.000")).toBeUndefined();
    expect(readAmount("−5.000")).toBeUndefined();
    expect(readAmount("1000000000000000")).toBeUndefined();
  });
});
