import { describe, expect, it } from "vitest";
import type { Booking, Part } from "@/lib/model/bookings";
import {
  bookingFigures,
  estimateTail,
  nextDue,
  originLine,
  removeBookingBody,
  splitConflict,
  splitToast,
} from "@/lib/model/booking-detail";
import { estimateDifference } from "@/lib/model/money";

// Task 4.6: the words and numbers of a booking's screen (guide §5.6, §6.9).

const TODAY = "2026-10-18";

const part = (over: Partial<Part>): Part => ({
  id: "p1",
  name: "Deposit",
  price: 10_000_000,
  paid: 0,
  funder: null,
  due: null,
  step: "",
  ...over,
});

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: "vendor-v1",
  kind: "vendor",
  recordId: "v1",
  name: "Villa Samaya Ubud",
  category: "Venue",
  price: 30_000_000,
  paid: 10_000_000,
  funder: null,
  due: null,
  step: "",
  parts: [],
  estimate: null,
  bookedOn: null,
  from: "vendor",
  direct: false,
  ...over,
});

describe("the figures", () => {
  it("says what's still to pay, with the share paid on the thread", () => {
    const f = bookingFigures(booking());
    expect(f).toMatchObject({ kicker: "Still to pay", amount: 20_000_000, pct: 33, tone: undefined, over: false });
    expect(f.ends).toEqual(["33% paid", "67% to go"]);
    expect(f.label).toBe("33% paid, 67% to go");
  });

  it("shows the amount over, positive, when overpaid", () => {
    const f = bookingFigures(booking({ price: 10_000_000, paid: 12_000_000 }));
    expect(f).toMatchObject({ kicker: "Overpaid by", amount: 2_000_000, tone: "over", over: true, pct: 100 });
    expect(f.ends[1]).toBe("overpaid");
  });

  it("shows the price in gold once nothing is left, and says so when there is no price", () => {
    expect(bookingFigures(booking({ price: 5, paid: 5 }))).toMatchObject({ kicker: "Paid in full", amount: 5, tone: "settled" });
    expect(bookingFigures(booking({ price: 0, paid: 0 }))).toMatchObject({ kicker: "No price yet", pct: 0 });
  });

  it("takes everything from the parts of a booking in parts", () => {
    const f = bookingFigures(booking({ parts: [part({ price: 4, paid: 4 }), part({ id: "p2", price: 6, paid: 0 })] }));
    expect(f).toMatchObject({ kicker: "Still to pay", amount: 6, price: 10, paid: 4, pct: 40 });
  });
});

describe("the origin line", () => {
  it("names where it came from and the day it was booked", () => {
    expect(originLine(booking({ bookedOn: "2026-03-01" }), TODAY)).toBe("Booked from Vendors on Sunday 1 March");
    expect(originLine(booking({ from: "venue", kind: "venue", bookedOn: "2026-03-01" }), TODAY)).toBe(
      "Booked from Venues on Sunday 1 March",
    );
  });

  it("leaves the day out when it isn't known, and never guesses (N8)", () => {
    expect(originLine(booking({ from: "direct", direct: true }), TODAY)).toBe("Added directly");
    expect(originLine(booking(), TODAY)).toBe("Booked from Vendors");
  });

  it("falls back to the kind for a booking that was never migrated", () => {
    expect(originLine(booking({ from: null, kind: "venue" }), TODAY)).toBe("Booked from Venues");
  });
});

describe("the next payment", () => {
  it("is the earliest unpaid part with a date, with its urgency", () => {
    const b = booking({
      parts: [part({ id: "a", paid: 10_000_000 }), part({ id: "b", due: "2026-10-10" }), part({ id: "c", due: "2026-10-20" })],
    });
    const due = nextDue(b, TODAY);
    expect(due?.part.id).toBe("b");
    expect(due?.urgency).toBe("late");
    expect(due?.left).toBe(10_000_000);
  });

  it("is none when nothing owing has a date", () => {
    expect(nextDue(booking(), TODAY)).toBeNull();
  });
});

describe("the estimate sentence", () => {
  it("says how much higher or lower the agreed price is", () => {
    const lower = estimateDifference(booking({ price: 28_000_000, estimate: 30_000_000 }));
    expect(lower && estimateTail(lower)).toEqual({ same: false, amount: "Rp 2.000.000", word: "lower" });
    const higher = estimateDifference(booking({ estimate: 25_000_000 }));
    expect(higher && estimateTail(higher)).toEqual({ same: false, amount: "Rp 5.000.000", word: "higher" });
  });

  it("says when they are the same", () => {
    const same = estimateDifference(booking({ price: 30_000_000, estimate: 30_000_000 }));
    expect(same && estimateTail(same)).toEqual({ same: true });
  });
});

describe("removing and splitting", () => {
  it("names what goes with the booking, and promises the undo", () => {
    const b = booking({ parts: [part({ paid: 10_000_000 }), part({ id: "p2" })] });
    expect(removeBookingBody(b, 2)).toBe(
      "It leaves the budget, with its 2 parts, Rp 10.000.000 of recorded payments and 2 files. You can undo for a few seconds.",
    );
    expect(removeBookingBody(booking({ paid: 0 }), 0)).toBe("It leaves the budget. You can undo for a few seconds.");
    // Offline before the files arrive (P7-S15): they're named without a count, never left out.
    expect(removeBookingBody(booking({ paid: 0 }), null)).toBe(
      "It leaves the budget, with its files. You can undo for a few seconds.",
    );
  });

  it("words the split toast and the conflict when Undo can't take it back (N13)", () => {
    expect(splitToast(2)).toBe("Split into 2 parts");
  });

  it("says what changed since a split when Undo can't take it back, as the prototype does (N13, P5-S3)", () => {
    const made = [
      part({ id: "d", name: "Deposit", price: 10_000_000, paid: 10_000_000 }),
      part({ id: "b", name: "Balance", price: 20_000_000, paid: 0 }),
    ];
    const paid = [made[0], { ...made[1], paid: 5_000_000 }];
    expect(splitConflict("Bella", made, paid)).toBe(
      "Can’t undo the split: Bella recorded Rp 5.000.000 on the balance since. Both parts stay as they are now.",
    );
    expect(splitConflict(null, made, paid)).toBe(
      "Can’t undo the split: you recorded Rp 5.000.000 on the balance since. Both parts stay as they are now.",
    );
    const dated = [made[0], { ...made[1], due: "2026-12-01" }];
    expect(splitConflict("Bella", made, dated)).toBe(
      "Can’t undo the split: Bella has changed the balance since. Both parts stay as they are now.",
    );
    expect(splitConflict(null, made, dated)).toBe(
      "Can’t undo the split: you have changed the balance since. Both parts stay as they are now.",
    );
    // Both parts changed, or a third added: no single change to name.
    const both = [{ ...made[0], step: "Call" }, { ...made[1], paid: 1 }];
    expect(splitConflict("Bella", made, both)).toBe(
      "Can’t undo the split: Bella has changed a part since. Both parts stay as they are now.",
    );
    const added = [...made, part({ id: "x", name: "Add-on" })];
    expect(splitConflict(null, made, added)).toBe(
      "Can’t undo the split: you’ve changed a part since. The parts stay as they are now.",
    );
  });
});
