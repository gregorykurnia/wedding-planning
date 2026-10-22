import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { vendorFromDoc, venueFromDoc } from "@/lib/data/adapters/bookings";
import { whatIfFromDoc } from "@/lib/data/adapters/what-if";
import { setBookingField } from "@/lib/data/booking-fields";
import { markBooked, recordPayment, splitBooking } from "@/lib/data/bookings";
import { removeFunder } from "@/lib/data/funders";
import { setVenueField } from "@/lib/data/venues";
import { setWhatIfPartField } from "@/lib/data/what-if";
import { WriteError } from "@/lib/data/write-error";
import { bookingFromVendor, bookingFromVenue } from "@/lib/model/bookings";
import { whatIfParts } from "@/lib/model/money";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

// Task 4.F1: the money and booking items from the Phase 1 and Phase 4 reviews
// (redesign/reviews/triage.md), each against the emulators.

let gregory: Partner;
let bella: Partner;

beforeAll(async () => {
  [gregory, bella] = await twoPartners();
});

afterAll(async () => {
  await Promise.all([closeClient(gregory), closeClient(bella)]);
});

beforeEach(async () => {
  await clearFirestore();
});

const g = () => ({ db: gregory.db });
const b = () => ({ db: bella.db });
const read = async (col: string, id: string) => (await getDoc(doc(gregory.db, col, id))).data()!;

const vendor = (extra: Record<string, unknown> = {}) => ({
  name: "Dapur Lestari Catering",
  category: "Food",
  contractStatus: "Chosen",
  booking: { on: "2026-10-01", from: "vendor", removed: false },
  funder: "CK",
  totalPrice: 100_000_000,
  budgetSpent: 0,
  nextTargetDate: "2026-12-01",
  nextAction: "",
  subEntries: [],
  priceOptions: [],
  createdAt: Timestamp.fromMillis(1),
  ...extra,
});

async function failure(run: () => Promise<unknown>): Promise<WriteError> {
  try {
    await run();
  } catch (err) {
    return err as WriteError;
  }
  throw new Error("expected a failure");
}

describe("payments and the split (P1-S6, P4-S8, P4-S7)", () => {
  it("moves the payments into the Deposit when splitting, and undo of the split puts them back", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendor());
    await recordPayment({ kind: "vendor", id: "v1" }, { amount: 30_000_000, paidOn: "2026-10-02", paidBy: "CK" }, { ...g(), paymentId: "pay1" });
    const split = await splitBooking({ kind: "vendor", id: "v1" }, g());
    let data = await read("vendors", "v1");
    expect(data.payments).toEqual([]);
    expect(data.budgetSpent).toBe(0);
    expect(data.subEntries[0]).toMatchObject({ name: "Deposit", budgetSpent: 30_000_000, payments: [expect.objectContaining({ id: "pay1", amount: 30_000_000 })] });

    await split.undo();
    data = await read("vendors", "v1");
    expect(data.subEntries).toEqual([]);
    expect(data).toMatchObject({ budgetSpent: 30_000_000, payments: [expect.objectContaining({ id: "pay1" })] });
  });

  it("won't take a payment back after the partner split the booking, and names the partner", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendor());
    const paid = await recordPayment({ kind: "vendor", id: "v1" }, { amount: 30_000_000, paidOn: null, paidBy: "CK" }, g());
    await splitBooking({ kind: "vendor", id: "v1" }, b());

    const refused = await failure(() => paid.undo());
    expect(refused.code).toBe("changed");
    expect(refused.by).toBe("partner");
    const data = await read("vendors", "v1");
    expect(data.budgetSpent).toBe(0);
    expect(data.subEntries[0].budgetSpent).toBe(30_000_000);
  });

  it("says it was you when your own change since is what stops the undo", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendor());
    const paid = await recordPayment({ kind: "vendor", id: "v1" }, { amount: 30_000_000, paidOn: null, paidBy: "CK" }, g());
    await splitBooking({ kind: "vendor", id: "v1" }, g());
    expect((await failure(() => paid.undo())).by).toBe("you");
  });

  it("won't take back a payment that is already gone, rather than doing nothing", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendor());
    const paid = await recordPayment({ kind: "vendor", id: "v1" }, { amount: 5_000_000, paidOn: null, paidBy: "CK" }, g());
    await setDoc(doc(bella.db, "vendors", "v1"), { payments: [], budgetSpent: 0 }, { merge: true });
    expect((await failure(() => paid.undo())).code).toBe("changed");
  });
});

describe("Try again with a changed amount (P4-S2)", () => {
  it("records the new amount under the same payment, once, and undo takes back what was recorded", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendor({ budgetSpent: 10_000_000 }));
    const target = { kind: "vendor" as const, id: "v1" };
    // The first try landed although the device was told it failed.
    await recordPayment(target, { amount: 5_000_000, paidOn: null, paidBy: "CK" }, { ...g(), paymentId: "pay1" });
    const again = await recordPayment(target, { amount: 7_000_000, paidOn: null, paidBy: "CK" }, { ...g(), paymentId: "pay1" });
    let data = await read("vendors", "v1");
    expect(data.budgetSpent).toBe(17_000_000);
    expect(data.payments).toEqual([expect.objectContaining({ id: "pay1", amount: 7_000_000 })]);

    await again.undo();
    data = await read("vendors", "v1");
    expect(data.budgetSpent).toBe(10_000_000);
    expect(data.payments).toEqual([]);
  });

  // Phase 5 review S1: the first try was still retrying when Try again committed.
  it("a late first try doesn't put its amount back over the one Try again recorded", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendor({ budgetSpent: 10_000_000 }));
    const target = { kind: "vendor" as const, id: "v1" };
    const again = await recordPayment(target, { amount: 7_000_000, paidOn: null, paidBy: "CK" }, { ...g(), paymentId: "pay1", triedAt: 2000 });
    await recordPayment(target, { amount: 5_000_000, paidOn: null, paidBy: "CK" }, { ...g(), paymentId: "pay1", triedAt: 1000 });
    let data = await read("vendors", "v1");
    expect(data.budgetSpent).toBe(17_000_000);
    expect(data.payments).toEqual([expect.objectContaining({ id: "pay1", amount: 7_000_000 })]);

    await again.undo();
    data = await read("vendors", "v1");
    expect(data.budgetSpent).toBe(10_000_000);
  });

  // Phase 5 review B2: the sheet re-picks the part left to pay (P4-S3), which isn't where the payment went.
  it("doesn't record it twice when the partner split the booking before Try again", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendor());
    await recordPayment({ kind: "vendor", id: "v1" }, { amount: 30_000_000, paidOn: null, paidBy: "CK" }, { ...g(), paymentId: "pay1" });
    await splitBooking({ kind: "vendor", id: "v1" }, b());
    const balance = (await read("vendors", "v1")).subEntries[1].id;

    await recordPayment({ kind: "vendor", id: "v1", partId: balance }, { amount: 30_000_000, paidOn: null, paidBy: "CK" }, { ...g(), paymentId: "pay1" });
    const data = await read("vendors", "v1");
    expect(data.subEntries[0]).toMatchObject({ budgetSpent: 30_000_000, payments: [expect.objectContaining({ id: "pay1" })] });
    expect(data.subEntries[1].budgetSpent ?? 0).toBe(0);
    expect(data.subEntries[1].payments ?? []).toEqual([]);
  });

  // Phase 6 review S13: the Deposit holds the whole overpaid payment but only its price as paid.
  // Phase 7 review S7: the cut comes off the Balance's unbacked paid, so the Deposit keeps its payment's.
  it("a lower Try again after an overpaid split leaves no part below 0, and the total right", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendor({ totalPrice: 10_000_000 }));
    const target = { kind: "vendor" as const, id: "v1" };
    await recordPayment(target, { amount: 12_000_000, paidOn: null, paidBy: "CK" }, { ...g(), paymentId: "pay1", triedAt: 1000 });
    await splitBooking(target, b());
    expect((await read("vendors", "v1")).subEntries.map((p: { budgetSpent: number }) => p.budgetSpent)).toEqual([10_000_000, 2_000_000]);

    await recordPayment(target, { amount: 1_000_000, paidOn: null, paidBy: "CK" }, { ...g(), paymentId: "pay1", triedAt: 2000 });
    const parts = (await read("vendors", "v1")).subEntries as { budgetSpent: number }[];
    expect(parts.map((p) => p.budgetSpent)).toEqual([1_000_000, 0]);
  });

  it("a lower Try again leaves an Add-on's paid alone, and its Undo still works (Phase 7 review S7)", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendor({ totalPrice: 10_000_000 }));
    const target = { kind: "vendor" as const, id: "v1" };
    await recordPayment(target, { amount: 12_000_000, paidOn: null, paidBy: "CK" }, { ...g(), paymentId: "pay1", triedAt: 1000 });
    await splitBooking(target, b());
    const split = (await read("vendors", "v1")).subEntries;
    await setDoc(
      doc(gregory.db, "vendors", "v1"),
      { subEntries: [...split, { id: "addon", name: "Add-on", totalPrice: 3_000_000, budgetSpent: 0, payments: [] }] },
      { merge: true },
    );
    const addOn = await recordPayment({ ...target, partId: "addon" }, { amount: 3_000_000, paidOn: null, paidBy: "CK" }, { ...g(), paymentId: "pay2" });

    await recordPayment(target, { amount: 1_000_000, paidOn: null, paidBy: "CK" }, { ...g(), paymentId: "pay1", triedAt: 2000 });
    const parts = () => read("vendors", "v1").then((d) => (d.subEntries as { budgetSpent: number }[]).map((p) => p.budgetSpent));
    expect(await parts()).toEqual([1_000_000, 0, 3_000_000]);
    await addOn.undo();
    expect(await parts()).toEqual([1_000_000, 0, 0]);
  });
});

describe("Split right after typing (P4-S5)", () => {
  it("waits for the price typed just before, so the parts take it", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendor({ budgetSpent: 20_000_000 }));
    const target = { kind: "vendor" as const, id: "v1" };
    // Blur saves the price, and the press on Split follows at once.
    const saving = setBookingField(target, "price", 150_000_000, g());
    await splitBooking(target, g());
    await saving;
    const data = await read("vendors", "v1");
    expect(data.subEntries.map((p: { name: string; totalPrice: number }) => [p.name, p.totalPrice])).toEqual([
      ["Deposit", 20_000_000],
      ["Balance", 130_000_000],
    ]);
    expect(data.totalPrice).toBe(0);
  });
});

describe("what-if parts with nobody to pay (P1-S8)", () => {
  it("removing a funder leaves the what-if parts it paid at Not assigned, not at the item's funder", async () => {
    await setDoc(doc(gregory.db, "funders", "CK"), { name: "CK", order: 0 });
    await setDoc(doc(gregory.db, "funders", "Bella"), { name: "Bella", order: 1 });
    await setDoc(doc(gregory.db, "hypotheticalItems", "w1"), {
      name: "Band",
      funder: "Bella",
      totalPrice: 0,
      subEntries: [
        { id: "a", name: "A", funder: "CK", totalPrice: 4 },
        { id: "b", name: "B", funder: null, totalPrice: 6 },
      ],
    });
    const removed = await removeFunder("CK", g());
    const parts = () => read("hypotheticalItems", "w1").then((d) => whatIfParts(whatIfFromDoc("w1", d)).map((p) => [p.name, p.funder]));
    expect(await parts()).toEqual([
      ["A", null],
      ["B", "Bella"],
    ]);

    await removed.undo();
    expect(await parts()).toEqual([
      ["A", "CK"],
      ["B", "Bella"],
    ]);
  });

  it("Not assigned on one part of an item with a funder really is nobody", async () => {
    await setDoc(doc(gregory.db, "hypotheticalItems", "w1"), {
      name: "Band",
      funder: "Bella",
      totalPrice: 0,
      subEntries: [
        { id: "a", name: "A", funder: null, totalPrice: 4 },
        { id: "b", name: "B", funder: null, totalPrice: 6 },
      ],
    });
    await setWhatIfPartField("w1", "a", "funder", null, g());
    const data = await read("hypotheticalItems", "w1");
    expect(whatIfParts(whatIfFromDoc("w1", data)).map((p) => [p.name, p.funder])).toEqual([
      ["A", null],
      ["B", "Bella"],
    ]);
  });
});

describe("estimates (P1-S18, P4-S4, P4-S13)", () => {
  it("Chosen with options and none marked takes the first option as the estimate", async () => {
    await setDoc(
      doc(gregory.db, "vendors", "v1"),
      vendor({
        contractStatus: "Consideration",
        booking: null,
        priceOptions: [
          { id: "o1", description: "Silver", price: 90_000_000, selected: false },
          { id: "o2", description: "Gold", price: 120_000_000, selected: false },
        ],
      }),
    );
    await markBooked({ kind: "vendor", id: "v1" }, "2026-10-14", g());
    expect((await read("vendors", "v1")).estimate).toBe(90_000_000);
  });

  it("keeps a cleared estimate as No estimate, even with an option we lean towards", async () => {
    await setDoc(
      doc(gregory.db, "vendors", "v1"),
      vendor({ estimate: null, priceOptions: [{ id: "o1", description: "Gold", price: 120_000_000, selected: true }] }),
    );
    expect(bookingFromVendor(vendorFromDoc("v1", await read("vendors", "v1"))).estimate).toBeNull();
  });

  it("reads a venue's cleared estimate as none, not Rp 0", async () => {
    await setDoc(doc(gregory.db, "venues", "p1"), { name: "Villa", status: "Booked", budgetEstimate: 300, agreedPrice: 280 });
    await setBookingField({ kind: "venue", id: "p1" }, "estimate", null, g());
    const venue = venueFromDoc("p1", await read("venues", "p1"));
    expect(venue.budgetEstimate).toBe(0);
    expect(bookingFromVenue(venue).estimate).toBeNull();
  });

  it("changing a booked venue's estimate before it had an agreed price keeps its price", async () => {
    // Booked by the old app, before migration 1.11: the price reads from the estimate.
    await setDoc(doc(gregory.db, "venues", "p1"), { name: "Villa", status: "Booked", budgetEstimate: 300 });
    await setBookingField({ kind: "venue", id: "p1" }, "estimate", 250, g());
    let booking = bookingFromVenue(venueFromDoc("p1", await read("venues", "p1")));
    expect([booking.price, booking.estimate]).toEqual([300, 250]);

    await setVenueField("p1", "cost", 200, g());
    booking = bookingFromVenue(venueFromDoc("p1", await read("venues", "p1")));
    expect([booking.price, booking.estimate]).toEqual([300, 200]);
  });

  it("a venue not booked yet keeps only its estimate, which becomes its price when booked", async () => {
    await setDoc(doc(gregory.db, "venues", "p1"), { name: "Villa", status: "Toured", budgetEstimate: 300 });
    await setVenueField("p1", "cost", 250, g());
    expect(await read("venues", "p1")).not.toHaveProperty("agreedPrice");
  });
});
