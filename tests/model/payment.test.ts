import { describe, expect, it } from "vitest";
import { bookingFromVendor, type Booking, type Part, type VendorRecord } from "@/lib/model/bookings";
import {
  funderOfValue,
  funderValue,
  NOT_ASSIGNED,
  paidByChoices,
  paymentPart,
  paymentSub,
  previewLine,
  recordedText,
  startAmount,
  startPaidBy,
} from "@/lib/model/payment";

// Task 4.4: the words and rules behind Record a payment (guide §5.4, §6.9).

const vendor = (over: Partial<VendorRecord> = {}): VendorRecord => ({
  id: "catering",
  name: "Dapur Lestari Catering",
  category: "Catering",
  contractStatus: "Chosen",
  funder: "greg",
  totalPrice: 30_000_000,
  budgetSpent: 10_000_000,
  nextTargetDate: "2026-10-30",
  nextAction: "",
  subEntries: [],
  ...over,
});

const single: Booking = bookingFromVendor(vendor());

const inParts: Booking = bookingFromVendor(
  vendor({
    name: "Villa Samaya Ubud",
    totalPrice: 50_000_000,
    budgetSpent: 25_000_000,
    subEntries: [
      { id: "deposit", name: "Deposit", funder: "family", totalPrice: 25_000_000, budgetSpent: 25_000_000, nextTargetDate: null, nextAction: "" },
      { id: "late", name: "Second Instalment", funder: "family", totalPrice: 10_000_000, budgetSpent: 0, nextTargetDate: "2026-11-15", nextAction: "" },
      { id: "balance", name: "Balance", funder: "family", totalPrice: 15_000_000, budgetSpent: 0, nextTargetDate: "2026-10-30", nextAction: "" },
    ],
  }),
);

describe("paymentPart", () => {
  it("is the booking's one line when it has no parts", () => {
    expect(paymentPart(single)?.id).toBeNull();
    expect(paymentPart(single)?.price).toBe(30_000_000);
  });

  it("is the part asked for", () => {
    expect(paymentPart(inParts, "deposit")?.name).toBe("Deposit");
  });

  it("is the earliest part still owing when none is asked for", () => {
    expect(paymentPart(inParts)?.id).toBe("balance");
  });

  it("falls to the first part still owing when none owing has a date", () => {
    const undated = bookingFromVendor(
      vendor({
        subEntries: [
          { id: "a", name: "A", funder: null, totalPrice: 5, budgetSpent: 5, nextTargetDate: null, nextAction: "" },
          { id: "b", name: "B", funder: null, totalPrice: 5, budgetSpent: 0, nextTargetDate: null, nextAction: "" },
        ],
      }),
    );
    expect(paymentPart(undated)?.id).toBe("b");
  });

  it("is nothing for a part that isn't there", () => {
    expect(paymentPart(inParts, "gone")).toBeNull();
  });
});

describe("paymentSub", () => {
  it("is the booking's name", () => {
    expect(paymentSub(single, paymentPart(single) as Part)).toBe("Dapur Lestari Catering");
  });

  it("adds the part's name in lower case for a booking in parts", () => {
    expect(paymentSub(inParts, paymentPart(inParts, "late") as Part)).toBe("Villa Samaya Ubud, second instalment");
  });
});

describe("startAmount", () => {
  it("is what's left", () => {
    expect(startAmount(paymentPart(single) as Part)).toBe(20_000_000);
  });

  it("is nothing when nothing is left, or when it's overpaid", () => {
    expect(startAmount(paymentPart(inParts, "deposit") as Part)).toBeNull();
    const over = bookingFromVendor(vendor({ totalPrice: 5, budgetSpent: 9 }));
    expect(startAmount(paymentPart(over) as Part)).toBeNull();
  });
});

describe("previewLine", () => {
  it("asks for an amount while there is none", () => {
    expect(previewLine(20_000_000, null, false)).toEqual({ text: "Enter the amount you paid", attention: false });
    expect(previewLine(20_000_000, 0, false).text).toBe("Enter the amount you paid");
  });

  it("says when the payment pays it in full", () => {
    expect(previewLine(20_000_000, 20_000_000, false)).toEqual({ text: "Pays this in full", attention: false });
  });

  it("says what is still to pay after a part payment", () => {
    expect(previewLine(20_000_000, 5_000_000, false)).toEqual({
      text: "Rp 15.000.000 still to pay after this",
      attention: false,
    });
  });

  it("warns, in rose, that more than what's left will show as overpaid", () => {
    expect(previewLine(20_000_000, 22_000_000, false)).toEqual({
      text: "This is Rp 2.000.000 more than what’s left. It will show as overpaid.",
      attention: true,
    });
    // Nothing left at all: every rupiah is over.
    expect(previewLine(0, 1_000_000, false).text).toBe(
      "This is Rp 1.000.000 more than what’s left. It will show as overpaid.",
    );
  });

  it("says the text isn't an amount yet, whatever else is true", () => {
    expect(previewLine(20_000_000, 20_000_000, true)).toEqual({ text: "That isn’t an amount yet", attention: true });
  });

  it("holds 13-digit amounts", () => {
    expect(previewLine(9_999_999_999_999, 1, false).text).toBe("Rp 9.999.999.999.998 still to pay after this");
  });
});

describe("recordedText", () => {
  it("names the amount and the booking", () => {
    expect(recordedText(55_500_000, "Dapur Lestari Catering")).toBe("Recorded Rp 55.500.000 for Dapur Lestari Catering");
  });
});

describe("Paid by", () => {
  const funders = [
    { id: "greg", name: "Greg" },
    { id: "family", name: "Bella’s family" },
  ];

  it("lists every funder, then Not assigned", () => {
    expect(paidByChoices(funders)).toEqual([
      { value: "greg", label: "Greg" },
      { value: "family", label: "Bella’s family" },
      { value: NOT_ASSIGNED, label: "Not assigned" },
    ]);
  });

  it("starts as the part's funder", () => {
    expect(startPaidBy(paymentPart(single) as Part, funders)).toBe("greg");
  });

  it("starts as Not assigned when the part has no funder or its funder is gone", () => {
    const none = bookingFromVendor(vendor({ funder: null }));
    expect(startPaidBy(paymentPart(none) as Part, funders)).toBe(NOT_ASSIGNED);
    const gone = bookingFromVendor(vendor({ funder: "removed" }));
    expect(startPaidBy(paymentPart(gone) as Part, funders)).toBe(NOT_ASSIGNED);
  });

  it("turns a chip's value back into a funder", () => {
    expect(funderOfValue(funderValue("greg"))).toBe("greg");
    expect(funderOfValue(funderValue(null))).toBeNull();
  });
});
