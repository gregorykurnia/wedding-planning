import { describe, expect, it } from "vitest";
import { amountMessage, amountProblem, readAmount } from "@/lib/model/amount";

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

// Task 4.4 (N16): why a money field refuses what was typed, and what it says.

describe("amountProblem", () => {
  it("accepts a blank field and the usual ways of typing an amount", () => {
    expect(amountProblem("")).toBeNull();
    expect(amountProblem("   ")).toBeNull();
    expect(amountProblem("Rp")).toBeNull();
    expect(amountProblem("Rp 12.500.000")).toBeNull();
    expect(amountProblem("12500000")).toBeNull();
    expect(amountProblem("45,000,000")).toBeNull();
    expect(amountProblem("0")).toBeNull();
    expect(amountProblem("999999999999999")).toBeNull();
  });

  it("names words", () => {
    expect(amountProblem("12 juta")).toBe("words");
    expect(amountProblem("a lot")).toBe("words");
  });

  it("names a minus, with either kind of sign", () => {
    expect(amountProblem("-5.000.000")).toBe("minus");
    expect(amountProblem("−5.000.000")).toBe("minus");
    expect(amountProblem("-")).toBe("minus");
  });

  it("names decimals instead of rounding them", () => {
    expect(amountProblem("12,5")).toBe("decimals");
    expect(amountProblem("1.5")).toBe("decimals");
  });

  it("names a figure of 16 digits or more", () => {
    expect(amountProblem("1000000000000000")).toBe("big");
  });

  it("agrees with readAmount on everything it accepts", () => {
    for (const text of ["Rp 12.500.000", "12500000", "0", "", "Rp "]) {
      expect(amountProblem(text)).toBeNull();
      expect(readAmount(text)).not.toBeUndefined();
    }
  });
});

describe("amountMessage", () => {
  it("quotes what was typed and says what the amount stays as", () => {
    expect(amountMessage("words", "12 juta", 12_500_000)).toBe(
      "“12 juta” isn’t an amount. Use digits, like 12500000. It stays Rp 12.500.000.",
    );
    expect(amountMessage("minus", "−5.000.000", 12_500_000)).toBe(
      "An amount can’t be below zero, so “−5.000.000” can’t be used. It stays Rp 12.500.000.",
    );
    expect(amountMessage("decimals", "12,5", 12_500_000)).toBe(
      "Rupiah amounts have no decimals, so “12,5” can’t be used. It stays Rp 12.500.000.",
    );
    expect(amountMessage("big", "1000000000000000", 12_500_000)).toBe(
      "That’s more than an amount can hold here: up to Rp 999.999.999.999.999. It stays Rp 12.500.000.",
    );
  });

  it("says nothing was changed when there was no amount before", () => {
    expect(amountMessage("words", "12 juta", null)).toBe(
      "“12 juta” isn’t an amount. Use digits, like 12500000. Nothing was changed.",
    );
  });

  it("cuts a long text at 40 characters", () => {
    const message = amountMessage("words", "x".repeat(60), null);
    expect(message).toContain(`“${"x".repeat(40)}…”`);
    expect(message).not.toContain("x".repeat(41));
  });
});
