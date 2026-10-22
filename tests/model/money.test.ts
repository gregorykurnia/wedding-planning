import { describe, expect, it } from "vitest";
import {
  bookingFromVenue,
  bookingsFrom,
  partsOf,
  type Booking,
  type PartRecord,
  type VendorRecord,
  type VenueRecord,
} from "@/lib/model/bookings";
import {
  SOON,
  budget,
  byFunder,
  collapseParts,
  dues,
  estimateDifference,
  partState,
  projected,
  recordPaymentPreview,
  splitPlan,
  totals,
  urgency,
  whatIfTotal,
  whatIfTotals,
} from "@/lib/model/money";

const TODAY = "2026-10-14";

const vendor = (over: Partial<VendorRecord> = {}): VendorRecord => ({
  id: "v1",
  name: "Dapur Lestari Catering",
  category: "Catering",
  contractStatus: "Chosen",
  funder: "Gregory",
  totalPrice: 100_000_000,
  budgetSpent: 0,
  nextTargetDate: null,
  nextAction: "",
  subEntries: [],
  ...over,
});

const venue = (over: Partial<VenueRecord> = {}): VenueRecord => ({
  id: "ve1",
  name: "Villa Samaya Ubud",
  status: "Booked",
  funder: "CK",
  budgetEstimate: 300_000_000,
  budgetSpent: 0,
  nextTargetDate: null,
  nextAction: "",
  subEntries: [],
  ...over,
});

const part = (over: Partial<PartRecord> = {}): PartRecord => ({
  id: "p1",
  name: "Part",
  totalPrice: 10_000_000,
  budgetSpent: 0,
  nextTargetDate: null,
  nextAction: "",
  ...over,
});

const single = (over: Partial<VendorRecord> = {}): Booking => bookingsFrom([vendor(over)], [])[0];

describe("bookingsFrom", () => {
  it("counts every booked venue, not only the first (§5 #1)", () => {
    const bs = bookingsFrom([], [venue({ id: "a" }), venue({ id: "b", name: "Gereja" }), venue({ id: "c", status: "Toured" })]);
    expect(bs.map((b) => b.id)).toEqual(["venue-a", "venue-b"]);
    expect(bs.every((b) => b.category === "Venue")).toBe(true);
  });

  it("uses the legacy status rule when a record has no booking field", () => {
    const bs = bookingsFrom(
      [
        vendor({ id: "chosen" }),
        vendor({ id: "done", contractStatus: "Done" }),
        vendor({ id: "inq", contractStatus: "Inquiring" }),
        vendor({ id: "rej", contractStatus: "Rejected" }),
      ],
      [],
    );
    expect(bs.map((b) => b.recordId)).toEqual(["chosen", "done"]);
  });

  it("uses the booking field once it is set, whatever the stage", () => {
    const bs = bookingsFrom(
      [
        vendor({ id: "marked", contractStatus: "Inquiring", booking: { on: "2026-03-01", from: "vendor", removed: false } }),
        vendor({ id: "removed", contractStatus: "Chosen", booking: { on: "2026-03-01", from: "vendor", removed: true } }),
        vendor({ id: "cleared", contractStatus: "Done", booking: null }),
      ],
      [venue({ id: "vn", status: "Toured", booking: { on: null, from: "venue", removed: false } })],
    );
    expect(bs.map((b) => b.id)).toEqual(["venue-vn", "vendor-marked"]);
    expect(bs[1].bookedOn).toBe("2026-03-01");
  });

  it("includes direct bookings and marks them", () => {
    const [b] = bookingsFrom([vendor({ contractStatus: "List", booking: { on: TODAY, from: "direct", removed: false } })], []);
    expect(b.direct).toBe(true);
    expect(b.from).toBe("direct");
  });

  it("takes the booking category from the vendor's current category (§5 #6)", () => {
    expect(single({ category: "Photography" }).category).toBe("Photography");
  });

  it("lets a part without a funder key inherit the parent's, but keeps an explicit null", () => {
    const b = single({ funder: "Bella", subEntries: [part({ id: "a" }), part({ id: "b", funder: null })] });
    expect(b.parts.map((p) => p.funder)).toEqual(["Bella", null]);
  });

  it("reads missing or broken amounts as 0 and rounds to whole rupiah", () => {
    const b = single({ totalPrice: Number.NaN, budgetSpent: 1_000.6 });
    expect(b.price).toBe(0);
    expect(b.paid).toBe(1_001);
  });
});

describe("estimate apart from agreed price (§5 #5, B12)", () => {
  it("a venue's price is its agreed price, and its estimate stays budgetEstimate", () => {
    const b = bookingFromVenue(venue({ budgetEstimate: 300_000_000, agreedPrice: 280_000_000 }));
    expect(b.price).toBe(280_000_000);
    expect(b.estimate).toBe(300_000_000);
    expect(estimateDifference(b)).toEqual({ estimate: 300_000_000, price: 280_000_000, difference: -20_000_000, direction: "lower" });
  });

  it("a legacy venue with no agreed price reads its price from budgetEstimate", () => {
    const b = bookingFromVenue(venue());
    expect(b.price).toBe(300_000_000);
    expect(estimateDifference(b)?.direction).toBe("same");
  });

  it("a vendor's estimate is its stored estimate, else the option we lean towards, else none", () => {
    expect(single({ estimate: 90_000_000 }).estimate).toBe(90_000_000);
    const leaning = single({ priceOptions: [{ price: 80_000_000, selected: false }, { price: 95_000_000, selected: true }] });
    expect(leaning.estimate).toBe(95_000_000);
    expect(estimateDifference(leaning)).toMatchObject({ difference: 5_000_000, direction: "higher" });
    expect(single().estimate).toBeNull();
    expect(estimateDifference(single())).toBeNull();
  });

  it("compares the estimate with the sum of the parts", () => {
    const b = single({ estimate: 25_000_000, subEntries: [part({ id: "a" }), part({ id: "b" })] });
    expect(estimateDifference(b)?.difference).toBe(-5_000_000);
  });
});

describe("totals", () => {
  it("still to pay is price minus paid", () => {
    const t = totals(single({ totalPrice: 50_000_000, budgetSpent: 20_000_000 }));
    expect(t).toMatchObject({ price: 50_000_000, paid: 20_000_000, left: 30_000_000, over: false, overBy: 0 });
  });

  it("a booking in parts takes price, paid, funders and next due from its parts (B4, §5 #3)", () => {
    const b = single({
      totalPrice: 999,
      budgetSpent: 999,
      funder: "Gregory",
      nextTargetDate: "2026-10-15",
      subEntries: [
        part({ id: "dp", totalPrice: 30_000_000, budgetSpent: 30_000_000, nextTargetDate: "2026-09-01", funder: "CK" }),
        part({ id: "b2", totalPrice: 40_000_000, nextTargetDate: "2026-12-01", funder: "Bella" }),
        part({ id: "b1", totalPrice: 30_000_000, nextTargetDate: "2026-11-01", funder: "Bella" }),
        part({ id: "nd", totalPrice: 5_000_000, funder: null }),
      ],
    });
    const t = totals(b);
    expect(t.price).toBe(105_000_000);
    expect(t.paid).toBe(30_000_000);
    expect(t.left).toBe(75_000_000);
    expect(t.next?.id).toBe("b1");
    expect(t.funders).toEqual(["CK", "Bella", null]);
  });

  it("next due skips paid parts and undated parts", () => {
    const t = totals(
      single({
        subEntries: [
          part({ id: "paid", nextTargetDate: "2026-10-01", budgetSpent: 10_000_000 }),
          part({ id: "undated" }),
        ],
      }),
    );
    expect(t.next).toBeNull();
  });

  it("an overpaid booking shows the amount over, never clamped", () => {
    const t = totals(single({ totalPrice: 10_000_000, budgetSpent: 11_000_000 }));
    expect(t).toMatchObject({ left: -1_000_000, over: true, overBy: 1_000_000, overParts: 1 });
  });

  it("an overpaid part shows even when the booking as a whole is not overpaid", () => {
    const t = totals(
      single({
        subEntries: [
          part({ id: "a", totalPrice: 10_000_000, budgetSpent: 12_000_000 }),
          part({ id: "b", totalPrice: 10_000_000, budgetSpent: 0 }),
        ],
      }),
    );
    expect(t.over).toBe(false);
    expect(t.overParts).toBe(1);
    expect(partState(partsOf(single({ subEntries: [part({ totalPrice: 1, budgetSpent: 2 })] }))[0], TODAY)).toBe("over");
  });

  it("handles 13-digit prices exactly", () => {
    const b = single({
      subEntries: Array.from({ length: 40 }, (_, i) =>
        part({ id: `p${i}`, totalPrice: 9_999_999_999_999, budgetSpent: i < 10 ? 9_999_999_999_999 : 0 }),
      ),
    });
    const t = totals(b);
    expect(t.price).toBe(399_999_999_999_960);
    expect(t.paid).toBe(99_999_999_999_990);
    expect(t.left).toBe(299_999_999_999_970);
    expect(Number.isSafeInteger(t.price)).toBe(true);
  });
});

describe("partState", () => {
  const p = (over: Partial<PartRecord>) => partsOf(single({ subEntries: [part(over)] }))[0];
  it("reads each line in guide §4.8", () => {
    expect(partState(p({ budgetSpent: 10_000_000 }), TODAY)).toBe("paid");
    expect(partState(p({ nextTargetDate: "2026-10-12" }), TODAY)).toBe("late");
    expect(partState(p({ nextTargetDate: TODAY }), TODAY)).toBe("due");
    expect(partState(p({ nextTargetDate: "2026-10-30" }), TODAY)).toBe("due");
    expect(partState(p({}), TODAY)).toBe("undated");
  });
  it("reads a part with no price as unpriced, not paid, whatever its date (P1-S16)", () => {
    expect(partState(p({ totalPrice: 0 }), TODAY)).toBe("unpriced");
    expect(partState(p({ totalPrice: 0, nextTargetDate: "2026-10-12" }), TODAY)).toBe("unpriced");
  });
});

describe("budget", () => {
  it("adds every booking, including every booked venue", () => {
    const bs = bookingsFrom(
      [vendor({ totalPrice: 100, budgetSpent: 40 })],
      [venue({ id: "a", budgetEstimate: 1_000, budgetSpent: 500 }), venue({ id: "b", budgetEstimate: 200, budgetSpent: 0 })],
    );
    expect(budget(bs)).toEqual({ count: 3, price: 1_300, paid: 540, left: 760, over: false, overBy: 0, overCount: 0 });
  });

  it("an overpaid budget reports the amount over as a positive number", () => {
    const bs = bookingsFrom([vendor({ totalPrice: 100, budgetSpent: 150 }), vendor({ id: "v2", totalPrice: 100, budgetSpent: 80 })], []);
    expect(budget(bs)).toMatchObject({ left: -30, over: true, overBy: 30, overCount: 1 });
  });

  it("is zero with nothing booked", () => {
    expect(budget([])).toEqual({ count: 0, price: 0, paid: 0, left: 0, over: false, overBy: 0, overCount: 0 });
  });
});

describe("urgency", () => {
  it("late before today, soon within 14 days, later after, none without a date", () => {
    expect(SOON).toBe(14);
    expect(urgency("2026-10-13", TODAY)).toBe("late");
    expect(urgency(TODAY, TODAY)).toBe("soon");
    expect(urgency("2026-10-28", TODAY)).toBe("soon");
    expect(urgency("2026-10-29", TODAY)).toBe("later");
    expect(urgency(null, TODAY)).toBe("none");
  });

  it("counts calendar days across a month and year end", () => {
    expect(urgency("2027-01-04", "2026-12-21")).toBe("soon");
    expect(urgency("2026-12-31", "2027-01-01")).toBe("late");
  });
});

describe("dues", () => {
  it("lists every unpaid dated part or booking; undated and paid ones never appear", () => {
    const bs = bookingsFrom(
      [
        vendor({ id: "single", totalPrice: 20_000_000, budgetSpent: 5_000_000, nextTargetDate: "2026-11-20" }),
        vendor({ id: "undated", nextTargetDate: null }),
        vendor({ id: "paid", totalPrice: 10, budgetSpent: 10, nextTargetDate: "2026-10-20" }),
        vendor({ id: "over", totalPrice: 10, budgetSpent: 11, nextTargetDate: "2026-10-20" }),
        vendor({
          id: "parts",
          subEntries: [
            part({ id: "late", totalPrice: 7, nextTargetDate: "2026-10-09" }),
            part({ id: "soon", totalPrice: 9, nextTargetDate: "2026-10-18" }),
            part({ id: "nodate", totalPrice: 9 }),
          ],
        }),
      ],
      [],
    );
    const ds = dues(bs, TODAY);
    expect(ds.map((d) => [d.booking.recordId, d.part.id, d.left, d.urgency])).toEqual([
      ["parts", "late", 7, "late"],
      ["parts", "soon", 9, "soon"],
      ["single", null, 15_000_000, "later"],
    ]);
  });

  it("orders the same day by the larger amount first", () => {
    const bs = bookingsFrom(
      [vendor({ id: "small", totalPrice: 1, nextTargetDate: TODAY }), vendor({ id: "big", totalPrice: 9, nextTargetDate: TODAY })],
      [],
    );
    expect(dues(bs, TODAY).map((d) => d.booking.recordId)).toEqual(["big", "small"]);
  });

  it("carries each part's own funder", () => {
    const bs = bookingsFrom([vendor({ funder: "CK", subEntries: [part({ funder: "Bella", nextTargetDate: TODAY })] })], []);
    expect(dues(bs, TODAY)[0].funder).toBe("Bella");
  });
});

describe("byFunder", () => {
  const funders = [
    { id: "Gregory", name: "Greg" },
    { id: "Bella", name: "Bella" },
  ];

  it("rolls up parts by their own funder, with Not assigned last showing paid and still to pay (§5 #4)", () => {
    const bs = bookingsFrom(
      [
        vendor({ funder: "Gregory", totalPrice: 100, budgetSpent: 30 }),
        vendor({
          id: "v2",
          funder: "Gregory",
          subEntries: [
            part({ id: "a", funder: "Bella", totalPrice: 50, budgetSpent: 50 }),
            part({ id: "b", funder: null, totalPrice: 40, budgetSpent: 10 }),
          ],
        }),
      ],
      [venue({ funder: null, budgetEstimate: 200, budgetSpent: 0 })],
    );
    const rows = byFunder(bs, funders);
    expect(rows.map((r) => [r.name, r.price, r.paid, r.left, r.count])).toEqual([
      ["Greg", 100, 30, 70, 1],
      ["Bella", 50, 50, 0, 1],
      ["Not assigned", 240, 10, 230, 2],
    ]);
  });

  it("adds up to the same totals as the budget, even with an unknown funder id", () => {
    const bs = bookingsFrom([vendor({ funder: "Removed", totalPrice: 70, budgetSpent: 5 }), vendor({ id: "v2", funder: "Bella" })], []);
    const rows = byFunder(bs, funders);
    const b = budget(bs);
    expect(rows.reduce((s, r) => s + r.price, 0)).toBe(b.price);
    expect(rows.reduce((s, r) => s + r.paid, 0)).toBe(b.paid);
    expect(rows.at(-1)).toMatchObject({ id: null, price: 70, paid: 5 });
  });

  it("marks an overpaid funder", () => {
    const rows = byFunder(bookingsFrom([vendor({ funder: "Bella", totalPrice: 10, budgetSpent: 12 })], []), funders);
    expect(rows[1]).toMatchObject({ left: -2, over: true });
  });

  it("still has the Not assigned row with no funders and nothing booked", () => {
    expect(byFunder([], [])).toEqual([{ id: null, name: "Not assigned", price: 0, paid: 0, left: 0, over: false, count: 0 }]);
  });
});

describe("what-if", () => {
  const funders = [{ id: "Gregory", name: "Greg" }, { id: "Bella", name: "Bella" }];

  it("an item's price is the sum of its parts, never the stale parent price (§5 #2)", () => {
    expect(whatIfTotal({ id: "w", name: "Band", totalPrice: 999, subEntries: [{ id: "a", name: "A", totalPrice: 10 }, { id: "b", name: "B", totalPrice: 5 }] })).toBe(15);
    expect(whatIfTotal({ id: "w", name: "Band", totalPrice: 20, subEntries: [] })).toBe(20);
  });

  it("totals items and who would pay the extra, with Not assigned last", () => {
    const t = whatIfTotals(
      [
        { id: "1", name: "Band", totalPrice: 30, funder: "Bella" },
        { id: "2", name: "Fireworks", totalPrice: 0, funder: "Gregory", subEntries: [{ id: "a", name: "A", totalPrice: 10 }, { id: "b", name: "B", totalPrice: 5, funder: null }] },
        { id: "3", name: "Legacy", totalPrice: 7 },
      ],
      funders,
    );
    expect(t.total).toBe(52);
    expect(t.count).toBe(3);
    expect(t.byFunder).toEqual([
      { id: "Gregory", name: "Greg", amount: 10 },
      { id: "Bella", name: "Bella", amount: 30 },
      { id: null, name: "Not assigned", amount: 12 },
    ]);
  });

  it("never mixes into the budget; only the projected total combines them", () => {
    const bs = bookingsFrom([vendor({ totalPrice: 100, budgetSpent: 0 })], []);
    const items = [{ id: "1", name: "Band", totalPrice: 30 }];
    expect(budget(bs).price).toBe(100);
    expect(projected(bs, items)).toEqual({ committed: 100, whatIf: 30, total: 130 });
  });
});

describe("collapseParts", () => {
  const parts = (n: number, paidFirst = 0) =>
    partsOf(
      single({
        subEntries: Array.from({ length: n }, (_, i) => part({ id: `p${i}`, totalPrice: 10, budgetSpent: i < paidFirst ? 10 : 0 })),
      }),
    );

  it("shows up to 5 parts as they are", () => {
    expect(collapseParts(parts(5))).toMatchObject({ more: 0 });
    expect(collapseParts(parts(5)).shown).toHaveLength(5);
  });

  it("past 5, shows the first 4 still owing and counts the rest", () => {
    const { shown, more } = collapseParts(parts(40, 3));
    expect(shown.map((p) => p.id)).toEqual(["p3", "p4", "p5", "p6"]);
    expect(more).toBe(36);
  });

  it("fills with paid parts, in order, when fewer than 4 still owe", () => {
    const ps = parts(6, 4);
    const { shown, more } = collapseParts(ps);
    expect(shown.map((p) => p.id)).toEqual(["p0", "p1", "p4", "p5"]);
    expect(more).toBe(2);
  });
});

describe("splitPlan (guide §6.9)", () => {
  let n = 0;
  const id = () => `n${++n}`;

  it("what's paid becomes a Deposit paid in full; the rest a Balance with the old date and step", () => {
    const b = single({ totalPrice: 100, budgetSpent: 30, funder: "Bella", nextTargetDate: "2026-11-01", nextAction: "Pay the balance" });
    const ps = splitPlan(b, id);
    expect(ps).toEqual([
      { id: expect.any(String), name: "Deposit", price: 30, paid: 30, funder: "Bella", due: null, step: "" },
      { id: expect.any(String), name: "Balance", price: 70, paid: 0, funder: "Bella", due: "2026-11-01", step: "Pay the balance" },
    ]);
    expect(new Set(ps.map((p) => p.id)).size).toBe(2);
  });

  it("with nothing paid, becomes one First payment", () => {
    const ps = splitPlan(single({ totalPrice: 100, budgetSpent: 0, nextTargetDate: "2026-11-01" }), id);
    expect(ps).toHaveLength(1);
    expect(ps[0]).toMatchObject({ name: "First payment", price: 100, paid: 0, due: "2026-11-01" });
  });

  // Phase 5 review S4: the deposit stays at the price; the extra reads overpaid on a Rp 0 Balance.
  it("caps the Deposit at the price and puts what was paid over it on a Rp 0 Balance", () => {
    const b = single({ totalPrice: 100, budgetSpent: 130, nextTargetDate: "2026-11-01", nextAction: "Ask for a refund" });
    expect(splitPlan(b, id)).toEqual([
      expect.objectContaining({ name: "Deposit", price: 100, paid: 100 }),
      expect.objectContaining({ name: "Balance", price: 0, paid: 30, due: "2026-11-01", step: "Ask for a refund" }),
    ]);
  });

  it("keeps the totals exactly, so an overpaid booking stays overpaid", () => {
    for (const [price, paid] of [[100, 30], [100, 100], [100, 130], [0, 0], [100, 0]]) {
      const b = single({ totalPrice: price, budgetSpent: paid });
      const split: Booking = { ...b, parts: splitPlan(b, id) };
      const [before, after] = [totals(b), totals(split)];
      expect([after.price, after.paid, after.over]).toEqual([before.price, before.paid, before.over]);
    }
  });
});

describe("recordPaymentPreview", () => {
  it("says pays in full, still to pay after, or more than what's left", () => {
    expect(recordPaymentPreview(100, 0)).toEqual({ kind: "empty" });
    expect(recordPaymentPreview(100, 100)).toEqual({ kind: "full" });
    expect(recordPaymentPreview(100, 40)).toEqual({ kind: "partial", after: 60 });
    expect(recordPaymentPreview(100, 130)).toEqual({ kind: "over", overBy: 30 });
  });

  it("an already overpaid line reports every new payment as over", () => {
    expect(recordPaymentPreview(-10, 5)).toEqual({ kind: "over", overBy: 15 });
  });

  it("handles 13-digit amounts", () => {
    expect(recordPaymentPreview(9_999_999_999_999, 1_000_000_000_000)).toEqual({ kind: "partial", after: 8_999_999_999_999 });
  });
});
