import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { collection, doc, getDoc, getDocs, setDoc, Timestamp, updateDoc } from "firebase/firestore";
import { bookingsFrom, isVendorBooked, isVenueBooked } from "@/lib/model/bookings";
import { byFunder, totals } from "@/lib/model/money";
import { vendorFromDoc, venueFromDoc } from "@/lib/data/adapters/bookings";
import { fundersFrom, funderFromDoc } from "@/lib/data/adapters/funders";
import {
  addDirectBooking,
  addPart,
  addWhatIfPart,
  markBooked,
  parseBookingId,
  recordPayment,
  removeBooking,
  removePart,
  removeVendor,
  removeVenue,
  removeWhatIf,
  removeWhatIfPart,
  splitBooking,
  splitWhatIf,
} from "@/lib/data/bookings";
import { addFunderWithUndo, newFunderId, removeFunder, renameFunderWithUndo } from "@/lib/data/funders";
import { removeCategory, renameCategory } from "@/lib/data/categories";
import { bookFinalist, copyToShortlist, moveFinalistToVendors, removeFinalist } from "@/lib/data/shortlist";
import { createFolder, deleteFolder, moveFile, moveFolder, renameFolder, setFileField } from "@/lib/data/files";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

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

async function read(col: string, id: string) {
  return (await getDoc(doc(gregory.db, col, id))).data();
}

async function exists(col: string, id: string) {
  return (await getDoc(doc(gregory.db, col, id))).exists();
}

async function bookingOf(kind: "vendor" | "venue", id: string) {
  const data = (await read(kind === "vendor" ? "vendors" : "venues", id))!;
  const record = kind === "vendor" ? vendorFromDoc(id, data) : venueFromDoc(id, data);
  return kind === "vendor"
    ? bookingsFrom([record as ReturnType<typeof vendorFromDoc>], [])[0]
    : bookingsFrom([], [record as ReturnType<typeof venueFromDoc>])[0];
}

const vendorDoc = (extra: Record<string, unknown> = {}) => ({
  name: "Dapur Lestari Catering",
  category: "Food",
  confirmedType: "Food",
  contractStatus: "Consideration",
  funder: "CK",
  totalPrice: 100_000_000,
  budgetSpent: 30_000_000,
  nextTargetDate: "2026-12-01",
  nextAction: "Pay the balance",
  subEntries: [],
  priceOptions: [
    { id: "o1", description: "Silver", price: 90_000_000, selected: false },
    { id: "o2", description: "Gold", price: 120_000_000, selected: true },
  ],
  createdAt: Timestamp.fromMillis(1),
  ...extra,
});

describe("markBooked", () => {
  it("makes a vendor a booking with its estimate from the option we lean towards, never twice; undo takes it back", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendorDoc());
    const first = await markBooked({ kind: "vendor", id: "v1" }, "2026-10-14", g());
    expect(first.changed).toBe(true);
    let data = await read("vendors", "v1");
    expect(data).toMatchObject({
      contractStatus: "Chosen",
      estimate: 120_000_000,
      booking: { on: "2026-10-14", from: "vendor", removed: false },
      totalPrice: 100_000_000,
    });

    const second = await markBooked({ kind: "vendor", id: "v1" }, "2026-11-01", b());
    expect(second.changed).toBe(false);
    expect((await read("vendors", "v1"))?.booking.on).toBe("2026-10-14");

    await first.undo();
    data = await read("vendors", "v1");
    expect(data).toMatchObject({ contractStatus: "Consideration" });
    expect(data).not.toHaveProperty("booking");
    expect(data).not.toHaveProperty("estimate");
  });

  it("makes a venue a booking with the agreed price starting at its estimate", async () => {
    await setDoc(doc(gregory.db, "venues", "p1"), { name: "Villa Samaya", status: "Toured", budgetEstimate: 300_000_000 });
    const done = await markBooked({ kind: "venue", id: "p1" }, "2026-03-01", g());
    expect(await read("venues", "p1")).toMatchObject({ status: "Booked", agreedPrice: 300_000_000 });
    expect(isVenueBooked(venueFromDoc("p1", (await read("venues", "p1"))!))).toBe(true);
    await done.undo();
    expect(await read("venues", "p1")).toMatchObject({ status: "Toured" });
    expect(await read("venues", "p1")).not.toHaveProperty("agreedPrice");
  });
});

describe("addDirectBooking", () => {
  it("adds a vendor record booked directly, and a retry with the same id adds nothing more", async () => {
    const input = { name: " Wedding rings ", category: "Other", price: 25_000_000, paid: 5_000_000, funder: "Bella", due: "2026-11-30", step: "Collect" };
    const { id, bookingId } = await addDirectBooking(input, "2026-10-14", { ...g(), id: "direct1" });
    await addDirectBooking(input, "2026-10-14", { ...g(), id: "direct1" });
    expect(parseBookingId(bookingId)).toEqual({ kind: "vendor", id });
    expect((await getDocs(collection(gregory.db, "vendors"))).size).toBe(1);
    const booking = await bookingOf("vendor", id);
    expect(booking).toMatchObject({ name: "Wedding rings", price: 25_000_000, paid: 5_000_000, direct: true, funder: "Bella" });
    await expect(addDirectBooking({ ...input, name: "  " }, null, g())).rejects.toMatchObject({ code: "failed" });
  });

  it("links the files attached to it to the new booking, in the same write", async () => {
    await setDoc(doc(gregory.db, "weddingFiles", "contract1"), { name: "Contract", folderId: null, url: "https://example.test/contract.pdf" });
    const input = { name: "Wedding rings", category: "Other", price: 25_000_000, paid: 0, funder: null, due: null, step: "", files: ["contract1"] };
    const { bookingId } = await addDirectBooking(input, "2026-10-14", { ...g(), id: "direct2" });
    expect((await read("weddingFiles", "contract1"))?.recordRef).toEqual({ kind: "booking", id: bookingId });
  });

  it("adds the booking when an attached file was deleted meanwhile, linking the rest (P4-S6)", async () => {
    await setDoc(doc(gregory.db, "weddingFiles", "kept1"), { name: "Receipt", folderId: null, url: "https://example.test/r.pdf" });
    const input = { name: "Wedding rings", category: "Other", price: 0, paid: 0, funder: null, due: null, step: "", files: ["no-such-file", "kept1"] };
    const { bookingId } = await addDirectBooking(input, null, { ...g(), id: "direct3" });
    expect(await exists("vendors", "direct3")).toBe(true);
    expect(await exists("weddingFiles", "no-such-file")).toBe(false);
    expect((await read("weddingFiles", "kept1"))?.recordRef).toEqual({ kind: "booking", id: bookingId });
  });

  it("makes the booking's own folder and puts the attached files in it, in the same write (P4-S6, P5-S11)", async () => {
    await setDoc(doc(gregory.db, "fileFolders", "root"), { name: "Bookings", parentId: null });
    await setDoc(doc(gregory.db, "weddingFiles", "contract2"), { name: "Contract", folderId: null, url: "https://example.test/c.pdf" });
    const input = { name: "Wedding rings", category: "Other", price: 0, paid: 0, funder: null, due: null, step: "", files: ["contract2"], folder: { id: "own", parentId: "root" } };
    // A try that fails leaves no folder behind.
    await expect(addDirectBooking({ ...input, price: undefined as unknown as number }, null, { ...g(), id: "direct4" })).rejects.toBeTruthy();
    expect(await exists("fileFolders", "own")).toBe(false);
    // Try again, with the name edited meanwhile: the folder has the name as added.
    const { bookingId } = await addDirectBooking({ ...input, name: "Rings" }, null, { ...g(), id: "direct4" });
    expect(await read("fileFolders", "own")).toMatchObject({ name: "Rings", parentId: "root", recordRef: { kind: "booking", id: bookingId } });
    expect((await read("weddingFiles", "contract2"))?.folderId).toBe("own");
  });
});

describe("split, parts, payments and removing a booking", () => {
  beforeEach(async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendorDoc({ contractStatus: "Chosen" }));
  });

  it("splits a booking into Deposit and Balance, and undo makes it single again", async () => {
    const split = await splitBooking({ kind: "vendor", id: "v1" }, g());
    expect(split.partIds).toHaveLength(2);
    let booking = await bookingOf("vendor", "v1");
    expect(booking.parts).toMatchObject([
      { name: "Deposit", price: 30_000_000, paid: 30_000_000, funder: "CK", due: null },
      { name: "Balance", price: 70_000_000, paid: 0, funder: "CK", due: "2026-12-01", step: "Pay the balance" },
    ]);
    expect(totals(booking)).toMatchObject({ price: 100_000_000, paid: 30_000_000 });
    await expect(splitBooking({ kind: "vendor", id: "v1" }, b())).rejects.toMatchObject({ code: "failed" });

    await split.undo();
    booking = await bookingOf("vendor", "v1");
    expect(booking.parts).toEqual([]);
    expect(booking).toMatchObject({ price: 100_000_000, paid: 30_000_000 });
  });

  it("splits a booking with nothing paid into one First payment", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendorDoc({ contractStatus: "Chosen", budgetSpent: 0 }));
    await splitBooking({ kind: "vendor", id: "v1" }, g());
    expect((await bookingOf("vendor", "v1")).parts.map((p) => p.name)).toEqual(["First payment"]);
  });

  it("adds an Add-on part with the last part's funder, removes a part, and undoes both", async () => {
    await splitBooking({ kind: "vendor", id: "v1" }, g());
    await recordPayment({ kind: "vendor", id: "v1", partId: (await bookingOf("vendor", "v1")).parts[1].id! }, { amount: 1, paidOn: null, paidBy: null }, g());
    const added = await addPart({ kind: "vendor", id: "v1" }, { ...b(), partId: "addon" });
    await addPart({ kind: "vendor", id: "v1" }, { ...b(), partId: "addon" });
    let booking = await bookingOf("vendor", "v1");
    expect(booking.parts.map((p) => [p.name, p.funder])).toEqual([["Deposit", "CK"], ["Balance", "CK"], ["Add-on", "CK"]]);

    const removed = await removePart({ kind: "vendor", id: "v1" }, booking.parts[1].id!, g());
    expect((await bookingOf("vendor", "v1")).parts.map((p) => p.name)).toEqual(["Deposit", "Add-on"]);
    await removed.undo();
    booking = await bookingOf("vendor", "v1");
    expect(booking.parts.map((p) => [p.name, p.paid])).toEqual([["Deposit", 30_000_000], ["Balance", 1], ["Add-on", 0]]);

    await added.undo();
    expect((await bookingOf("vendor", "v1")).parts.map((p) => p.name)).toEqual(["Deposit", "Balance"]);
  });

  it("comes to Rp 0 once every part is removed, and undo of the last removal brings that part back", async () => {
    await splitBooking({ kind: "vendor", id: "v1" }, g());
    const [deposit, balance] = (await bookingOf("vendor", "v1")).parts;
    await removePart({ kind: "vendor", id: "v1" }, deposit.id!, g());
    const last = await removePart({ kind: "vendor", id: "v1" }, balance.id!, g());
    let booking = await bookingOf("vendor", "v1");
    expect(booking).toMatchObject({ parts: [], price: 0, paid: 0, due: null, step: "" });

    await last.undo();
    booking = await bookingOf("vendor", "v1");
    expect(booking.parts.map((p) => [p.name, p.price])).toEqual([["Balance", 70_000_000]]);
    expect(totals(booking)).toMatchObject({ price: 70_000_000, paid: 0 });
  });

  it("empties a venue's own price when its last part goes, so it doesn't fall back to the estimate", async () => {
    await setDoc(doc(gregory.db, "venues", "ve1"), {
      name: "Kebun", status: "Booked", budgetEstimate: 80_000_000, budgetSpent: 10_000_000, nextTargetDate: "2026-12-01",
      subEntries: [{ id: "only", name: "Balance", totalPrice: 70_000_000, budgetSpent: 0 }],
    });
    await removePart({ kind: "venue", id: "ve1" }, "only", g());
    expect(await bookingOf("venue", "ve1")).toMatchObject({ parts: [], price: 0, paid: 0, due: null, estimate: 80_000_000 });
  });

  it("records a payment on a single booking and on a part, keeps the history, and undo takes it out", async () => {
    const single = await recordPayment(
      { kind: "vendor", id: "v1" },
      { amount: 20_000_000, paidOn: "2026-10-14", paidBy: "Gregory", receiptFileId: "f1" },
      { ...b(), paymentId: "pay1" },
    );
    // A retry with the same id doesn't count it twice.
    await recordPayment(
      { kind: "vendor", id: "v1" },
      { amount: 20_000_000, paidOn: "2026-10-14", paidBy: "Gregory", receiptFileId: "f1" },
      { ...b(), paymentId: "pay1" },
    );
    let data = await read("vendors", "v1");
    expect(data?.budgetSpent).toBe(50_000_000);
    expect(data?.payments).toEqual([{ id: "pay1", amount: 20_000_000, paidOn: "2026-10-14", funder: "Gregory", receiptFileId: "f1", triedAt: expect.any(Number) }]);
    await single.undo();
    data = await read("vendors", "v1");
    expect(data?.budgetSpent).toBe(30_000_000);
    expect(data?.payments).toEqual([]);

    const { partIds } = await splitBooking({ kind: "vendor", id: "v1" }, g());
    await expect(
      recordPayment({ kind: "vendor", id: "v1" }, { amount: 5, paidOn: null, paidBy: null }, g()),
    ).rejects.toMatchObject({ code: "failed" });
    const onPart = await recordPayment(
      { kind: "vendor", id: "v1", partId: partIds[1] },
      { amount: 80_000_000, paidOn: "2026-10-15", paidBy: "CK" },
      g(),
    );
    let booking = await bookingOf("vendor", "v1");
    expect(booking.parts[1]).toMatchObject({ paid: 80_000_000 });
    // Paying more than what's left is allowed and shows as overpaid.
    expect(totals(booking).over).toBe(true);
    await onPart.undo();
    booking = await bookingOf("vendor", "v1");
    expect(booking.parts[1]).toMatchObject({ paid: 0 });
    await expect(
      recordPayment({ kind: "vendor", id: "v1" }, { amount: 0, paidOn: null, paidBy: null }, g()),
    ).rejects.toMatchObject({ code: "failed" });
  });

  it("won't undo a split once a part was paid, so the payment is never lost", async () => {
    const split = await splitBooking({ kind: "vendor", id: "v1" }, g());
    // Bella pays on the Balance while Gregory's undo toast is still open.
    await recordPayment({ kind: "vendor", id: "v1", partId: split.partIds[1] }, { amount: 20_000_000, paidOn: "2026-10-14", paidBy: "CK" }, b());
    await expect(split.undo()).rejects.toMatchObject({ code: "changed" });
    const booking = await bookingOf("vendor", "v1");
    expect(booking.parts.map((p) => [p.name, p.paid])).toEqual([["Deposit", 30_000_000], ["Balance", 20_000_000]]);
    expect(totals(booking).paid).toBe(50_000_000);
  });

  it("undoes an added part without touching a payment recorded on another part meanwhile", async () => {
    const { partIds } = await splitBooking({ kind: "vendor", id: "v1" }, g());
    const added = await addPart({ kind: "vendor", id: "v1" }, { ...g(), partId: "addon" });
    await recordPayment({ kind: "vendor", id: "v1", partId: partIds[0] }, { amount: 20_000_000, paidOn: null, paidBy: "CK" }, b());
    await added.undo();
    const booking = await bookingOf("vendor", "v1");
    expect(booking.parts.map((p) => [p.name, p.paid])).toEqual([["Deposit", 50_000_000], ["Balance", 0]]);
    expect((await read("vendors", "v1"))?.subEntries[0].payments).toHaveLength(1);
  });

  it("won't undo an added part that was paid since; already gone, undo does nothing", async () => {
    await splitBooking({ kind: "vendor", id: "v1" }, g());
    const added = await addPart({ kind: "vendor", id: "v1" }, { ...g(), partId: "addon" });
    await recordPayment({ kind: "vendor", id: "v1", partId: "addon" }, { amount: 5_000_000, paidOn: null, paidBy: "CK" }, b());
    await expect(added.undo()).rejects.toMatchObject({ code: "changed" });
    expect((await bookingOf("vendor", "v1")).parts.map((p) => [p.name, p.paid])).toEqual([["Deposit", 30_000_000], ["Balance", 0], ["Add-on", 5_000_000]]);

    const second = await addPart({ kind: "vendor", id: "v1" }, { ...g(), partId: "second" });
    await removePart({ kind: "vendor", id: "v1" }, "second", b());
    await second.undo();
    expect((await bookingOf("vendor", "v1")).parts).toHaveLength(3);
  });

  it("removes a split booking from the budget and undo restores it with its parts", async () => {
    await splitBooking({ kind: "vendor", id: "v1" }, g());
    const before = await bookingOf("vendor", "v1");
    const removed = await removeBooking({ kind: "vendor", id: "v1" }, b());
    let data = await read("vendors", "v1");
    expect(isVendorBooked(vendorFromDoc("v1", data!))).toBe(false);
    expect(data?.booking).toEqual({ on: null, from: "vendor", removed: true });
    expect(data?.subEntries).toHaveLength(2);

    await removed.undo();
    data = await read("vendors", "v1");
    expect(isVendorBooked(vendorFromDoc("v1", data!))).toBe(true);
    expect(await bookingOf("vendor", "v1")).toEqual(before);
  });

  it("won't remove a vendor or venue that is a booking unless asked; undo restores the record", async () => {
    await expect(removeVendor("v1", g())).rejects.toThrow(/booking/);
    const removed = await removeVendor("v1", { ...g(), evenIfBooked: true });
    expect(await exists("vendors", "v1")).toBe(false);
    await removed.undo();
    expect(await read("vendors", "v1")).toMatchObject({ name: "Dapur Lestari Catering" });

    await setDoc(doc(gregory.db, "venues", "p1"), { name: "Lawn", status: "Contacted" });
    const venue = await removeVenue("p1", b());
    expect(await exists("venues", "p1")).toBe(false);
    await venue.undo();
    expect(await exists("venues", "p1")).toBe(true);
  });
});

describe("what-if items", () => {
  beforeEach(async () => {
    await setDoc(doc(gregory.db, "hypotheticalItems", "w1"), {
      name: "Live band",
      type: "Music/DJ",
      totalPrice: 40_000_000,
      funder: "Bella",
      subEntries: [],
    });
  });

  it("splits into Part 1 and Part 2, adds a part, and merges back when one is left", async () => {
    const split = await splitWhatIf("w1", g());
    let data = await read("hypotheticalItems", "w1");
    expect(data?.subEntries.map((p: { name: string; totalPrice: number; funder: string }) => [p.name, p.totalPrice, p.funder])).toEqual([
      ["Part 1", 40_000_000, "Bella"],
      ["Part 2", 0, "Bella"],
    ]);
    const added = await addWhatIfPart("w1", { ...b(), partId: "p3" });
    expect((await read("hypotheticalItems", "w1"))?.subEntries).toHaveLength(3);
    await added.undo();

    const [p1, p2] = split.partIds;
    await setDoc(doc(gregory.db, "hypotheticalItems", "w1"), {
      subEntries: [
        { id: p1, name: "Part 1", totalPrice: 40_000_000, funder: "Bella" },
        { id: p2, name: "Part 2", totalPrice: 5_000_000, funder: "CK" },
      ],
    }, { merge: true });
    const merged = await removeWhatIfPart("w1", p1, g());
    data = await read("hypotheticalItems", "w1");
    expect(data).toMatchObject({ subEntries: [], totalPrice: 5_000_000, funder: "CK" });

    await merged.undo();
    data = await read("hypotheticalItems", "w1");
    // The split moved the funder into the parts, so the item has none of its own to give back.
    expect(data).toMatchObject({ totalPrice: 40_000_000, funder: null });
    expect(data?.subEntries).toHaveLength(2);
  });

  it("undoes a what-if split back to one item, but not after a part was changed", async () => {
    const split = await splitWhatIf("w1", g());
    await split.undo();
    expect(await read("hypotheticalItems", "w1")).toMatchObject({ subEntries: [], totalPrice: 40_000_000, funder: "Bella" });

    const again = await splitWhatIf("w1", g());
    const added = await addWhatIfPart("w1", { ...b(), partId: "p3" });
    await expect(again.undo()).rejects.toMatchObject({ code: "changed" });
    await added.undo();
    await again.undo();
    expect((await read("hypotheticalItems", "w1"))?.subEntries).toEqual([]);
  });

  it("removes a what-if item with undo", async () => {
    const removed = await removeWhatIf("w1", g());
    expect(await exists("hypotheticalItems", "w1")).toBe(false);
    await removed.undo();
    expect(await read("hypotheticalItems", "w1")).toMatchObject({ name: "Live band" });
  });
});

describe("funders", () => {
  it("removing a funder moves its costs to Not assigned, keeps payments, and undo gives them back", async () => {
    await setDoc(doc(gregory.db, "funders", "CK"), { name: "CK", order: 0 });
    await setDoc(doc(gregory.db, "funders", "Bella"), { name: "Bella", order: 1 });
    await setDoc(doc(gregory.db, "vendors", "v1"), vendorDoc({ contractStatus: "Chosen", payments: [{ id: "x", amount: 1, funder: "CK" }] }));
    await setDoc(doc(gregory.db, "venues", "p1"), {
      name: "Villa",
      status: "Booked",
      funder: "Bella",
      budgetEstimate: 10,
      subEntries: [
        { id: "a", name: "A", funder: "CK", totalPrice: 4 },
        { id: "b", name: "B", funder: "Bella", totalPrice: 6 },
      ],
    });
    await setDoc(doc(gregory.db, "hypotheticalItems", "w1"), { name: "Band", funder: "CK", totalPrice: 7 });

    const removed = await removeFunder("CK", g());
    expect(removed.moved).toBe(3);
    expect(await exists("funders", "CK")).toBe(false);
    expect(await read("vendors", "v1")).toMatchObject({ funder: null, payments: [{ id: "x", amount: 1, funder: "CK" }] });
    expect((await read("venues", "p1"))?.subEntries.map((p: { funder: string | null }) => p.funder)).toEqual([null, "Bella"]);
    expect((await read("hypotheticalItems", "w1"))?.funder).toBeNull();

    const funders = fundersFrom(
      (await getDocs(collection(gregory.db, "funders"))).docs.map((d) => funderFromDoc(d.id, d.data())),
    );
    const rows = byFunder(
      bookingsFrom([vendorFromDoc("v1", (await read("vendors", "v1"))!)], [venueFromDoc("p1", (await read("venues", "p1"))!)]),
      funders,
    );
    expect(rows.map((r) => [r.name, r.price])).toEqual([["Bella", 6], ["Not assigned", 100_000_004]]);

    // Bella gives the what-if item a funder before the undo: hers stays.
    await setDoc(doc(bella.db, "hypotheticalItems", "w1"), { funder: "Bella" }, { merge: true });
    await removed.undo();
    expect(await read("funders", "CK")).toMatchObject({ name: "CK", order: 0 });
    expect((await read("vendors", "v1"))?.funder).toBe("CK");
    expect((await read("venues", "p1"))?.subEntries.map((p: { funder: string | null }) => p.funder)).toEqual(["CK", "Bella"]);
    expect((await read("hypotheticalItems", "w1"))?.funder).toBe("Bella");
  });

  it("renames a funder with undo", async () => {
    await setDoc(doc(gregory.db, "funders", "Bella Fam"), { name: "Bella Fam", order: 3 });
    const renamed = await renameFunderWithUndo("Bella Fam", " Bella's family ", g());
    expect((await read("funders", "Bella Fam"))?.name).toBe("Bella's family");
    await renamed.undo();
    expect((await read("funders", "Bella Fam"))?.name).toBe("Bella Fam");
    await expect(renameFunderWithUndo("Bella Fam", " ", g())).rejects.toMatchObject({ code: "failed" });
  });

  it("adds a funder under an id made first, so a retry never makes two, and undo removes it", async () => {
    const id = newFunderId(g());
    const added = await addFunderWithUndo(id, " Tante Lily ", 4, g());
    expect(await read("funders", id)).toMatchObject({ name: "Tante Lily", order: 4, createdBy: expect.any(String) });
    // Try again after a timeout writes the same document.
    await addFunderWithUndo(id, "Tante Lily", 4, g());
    expect((await getDocs(collection(gregory.db, "funders"))).size).toBe(1);
    await expect(addFunderWithUndo(newFunderId(g()), "  ", 5, g())).rejects.toMatchObject({ code: "failed" });

    // A cost given to her in the few seconds since moves to Not assigned with her.
    await setDoc(doc(gregory.db, "vendors", "v1"), vendorDoc({ funder: id }));
    await added.undo();
    expect(await exists("funders", id)).toBe(false);
    expect((await read("vendors", "v1"))?.funder).toBeNull();
  });
});

describe("categories", () => {
  beforeEach(async () => {
    await setDoc(doc(gregory.db, "vendorCategories", "c1"), { name: "Henna", createdAt: Timestamp.fromMillis(5) });
    await setDoc(doc(gregory.db, "vendors", "v1"), vendorDoc({ category: "Henna", confirmedType: "Henna" }));
    await setDoc(doc(gregory.db, "vendors", "v2"), vendorDoc({ category: "Food", confirmedType: "Food" }));
    await setDoc(doc(gregory.db, "shortlist", "s1"), {
      name: "Inai",
      type: "Henna",
      subEntries: [{ id: "k1", name: "Basic", type: "Henna" }],
    });
  });

  it("renames ours everywhere it's used, refuses a taken name, and undo puts it back", async () => {
    await expect(renameCategory("c1", "food", g())).rejects.toThrow(/already a category called Food/);
    const renamed = await renameCategory("c1", "Henna art", g());
    expect(await read("vendorCategories", "c1")).toMatchObject({ name: "Henna art" });
    expect(await read("vendors", "v1")).toMatchObject({ category: "Henna art", confirmedType: "Henna art" });
    expect(await read("vendors", "v2")).toMatchObject({ category: "Food" });
    expect(await read("shortlist", "s1")).toMatchObject({ type: "Henna art", subEntries: [{ type: "Henna art" }] });

    await renamed.undo();
    expect(await read("vendorCategories", "c1")).toMatchObject({ name: "Henna" });
    expect(await read("vendors", "v1")).toMatchObject({ category: "Henna", confirmedType: "Henna" });
    expect(await read("shortlist", "s1")).toMatchObject({ type: "Henna", subEntries: [{ type: "Henna" }] });
  });

  it("removes ours, moving vendors and finalists to Other; undo brings the category back in its place", async () => {
    const removed = await removeCategory("c1", g());
    expect(removed.moved).toBe(2);
    expect(await exists("vendorCategories", "c1")).toBe(false);
    expect(await read("vendors", "v1")).toMatchObject({ category: "Other", confirmedType: "Other" });
    expect(await read("shortlist", "s1")).toMatchObject({ type: "Other" });

    // Bella moves the finalist to Food before the undo: it stays in Food.
    await setDoc(doc(bella.db, "shortlist", "s1"), { type: "Food" }, { merge: true });
    await removed.undo();
    const category = await read("vendorCategories", "c1");
    expect(category).toMatchObject({ name: "Henna" });
    expect((category?.createdAt as Timestamp).toMillis()).toBe(5);
    expect(await read("vendors", "v1")).toMatchObject({ category: "Henna", confirmedType: "Henna" });
    expect(await read("shortlist", "s1")).toMatchObject({ type: "Food", subEntries: [{ type: "Henna" }] });
  });
});

describe("shortlist", () => {
  beforeEach(async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendorDoc({ contactName: "Ayu", contactPhone: "0812", bridestoryReviewCount: 120 }));
  });

  it("copies a vendor once, with the option we lean towards as the main package; undo removes the copy", async () => {
    const copied = await copyToShortlist("v1", g());
    expect(copied.created).toBe(true);
    const again = await copyToShortlist("v1", b());
    expect(again).toMatchObject({ finalistId: copied.finalistId, created: false });
    const data = await read("shortlist", copied.finalistId);
    expect(data).toMatchObject({
      name: "Dapur Lestari Catering",
      type: "Food",
      price: 120_000_000,
      priceDescription: "Gold",
      sourceVendorId: "v1",
      preferredPackageId: "main",
      bridestoryReviewers: 120,
      subEntries: [{ name: "Silver", price: 90_000_000 }],
    });
    await copied.undo();
    expect(await exists("shortlist", copied.finalistId)).toBe(false);
  });

  it("copies what each price option includes into its package", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), vendorDoc({
      priceOptions: [
        { id: "o1", description: "Silver", price: 90_000_000, includes: "Buffet, 5 dishes", selected: false },
        { id: "o2", description: "Gold", price: 120_000_000, includes: "Buffet, 7 dishes", selected: true },
      ],
    }));
    const { finalistId } = await copyToShortlist("v1", g());
    expect(await read("shortlist", finalistId)).toMatchObject({
      includes: "Buffet, 7 dishes",
      subEntries: [{ name: "Silver", includes: "Buffet, 5 dishes" }],
    });
  });

  it("books a copied finalist by booking its vendor, never twice; undo takes the booking back", async () => {
    const { finalistId } = await copyToShortlist("v1", g());
    const silver = (await read("shortlist", finalistId))?.subEntries[0].id;
    const booked = await bookFinalist(finalistId, silver, "2026-10-14", b());
    expect(booked).toMatchObject({ bookingId: "vendor-v1", vendorId: "v1" });
    expect(await read("vendors", "v1")).toMatchObject({
      contractStatus: "Chosen",
      estimate: 90_000_000,
      totalPrice: 100_000_000,
      booking: { on: "2026-10-14", from: "finalist", removed: false },
    });
    expect(await read("shortlist", finalistId)).toMatchObject({
      movedTo: { kind: "booking", id: "vendor-v1" },
      preferredPackageId: silver,
    });
    expect((await bookFinalist(finalistId, "main", null, g())).bookingId).toBe("vendor-v1");

    await booked.undo();
    // Fields that were missing are missing again, not null (review P1-S9).
    const vendor = await read("vendors", "v1");
    expect(vendor).toMatchObject({ contractStatus: "Consideration", totalPrice: 100_000_000 });
    expect(vendor).not.toHaveProperty("booking");
    expect(vendor).not.toHaveProperty("estimate");
    const finalist = await read("shortlist", finalistId);
    expect(finalist).toMatchObject({ preferredPackageId: "main" });
    expect(finalist).not.toHaveProperty("movedTo");
  });

  it("writes nothing for a vendor that's already booked, also as Chosen in the old screens (P1-S9, P4-S10)", async () => {
    const { finalistId } = await copyToShortlist("v1", g());
    for (const already of [{ contractStatus: "Chosen" }, { booking: { on: "2026-09-01", from: "vendor", removed: false } }]) {
      await updateDoc(doc(gregory.db, "vendors", "v1"), already);
      const before = await read("vendors", "v1");
      const booked = await bookFinalist(finalistId, "main", "2026-10-14", b());
      expect(booked.bookingId).toBe("vendor-v1");
      expect(await read("vendors", "v1")).toEqual(before);
      expect(await read("shortlist", finalistId)).not.toHaveProperty("movedTo");
      await booked.undo();
      expect(await read("vendors", "v1")).toEqual(before);
    }
  });

  it("books a finalist again once its booking was removed (P4-S10)", async () => {
    const { finalistId } = await copyToShortlist("v1", g());
    await bookFinalist(finalistId, "main", "2026-10-14", g());
    await removeBooking({ kind: "vendor", id: "v1" }, b());
    const again = await bookFinalist(finalistId, "main", "2026-10-20", b());
    expect(again.bookingId).toBe("vendor-v1");
    expect(await read("vendors", "v1")).toMatchObject({ booking: { on: "2026-10-20", from: "finalist", removed: false } });
    await again.undo();
    expect(await read("vendors", "v1")).toMatchObject({ booking: { on: "2026-10-14", removed: true } });
  });

  it("books a finalist added straight to the shortlist as a new vendor booking; undo removes it", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), { name: "Arka Studio", type: "Photos and Videos", price: 15, priceDescription: "Full day" });
    const booked = await bookFinalist("s1", "main", "2026-10-14", { ...g(), vendorId: "new1" });
    expect(await read("vendors", "new1")).toMatchObject({
      name: "Arka Studio",
      category: "Photos and Videos",
      totalPrice: 15,
      estimate: 15,
      booking: { from: "finalist", removed: false },
    });
    expect((await bookingOf("vendor", "new1")).from).toBe("finalist");
    // The new vendor is the finalist's source now, so copying it finds this finalist.
    expect(await read("shortlist", "s1")).toMatchObject({ sourceVendorId: "new1" });
    expect(await copyToShortlist("new1", b())).toMatchObject({ finalistId: "s1", created: false });
    await booked.undo();
    expect(await exists("vendors", "new1")).toBe(false);
    expect(await read("shortlist", "s1")).not.toHaveProperty("movedTo");
    expect(await read("shortlist", "s1")).not.toHaveProperty("sourceVendorId");
  });

  it("moves a from-scratch finalist into Vendors once; undo removes the vendor", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), {
      name: "Arka Studio",
      type: "Photos and Videos",
      price: 15,
      priceDescription: "Full day",
      subEntries: [{ id: "k1", name: "Half day", price: 9, priceDescription: "4 hours" }],
      preferredPackageId: "k1",
    });
    const moved = await moveFinalistToVendors("s1", { ...g(), vendorId: "new2" });
    expect(await read("vendors", "new2")).toMatchObject({
      name: "Arka Studio",
      contractStatus: "Consideration",
      priceOptions: [
        { description: "Full day", price: 15, selected: false },
        { id: "k1", description: "4 hours", price: 9, selected: true },
      ],
    });
    expect(await read("shortlist", "s1")).toMatchObject({ sourceVendorId: "new2", movedTo: { kind: "vendor", id: "new2" } });
    await expect(moveFinalistToVendors("s1", b())).rejects.toMatchObject({ code: "failed" });

    await moved.undo();
    expect(await exists("vendors", "new2")).toBe(false);
    expect(await read("shortlist", "s1")).toMatchObject({ sourceVendorId: null, movedTo: null });
  });

  it("removes a finalist with undo", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), { name: "Arka" });
    const removed = await removeFinalist("s1", g());
    expect(await exists("shortlist", "s1")).toBe(false);
    await removed.undo();
    expect(await exists("shortlist", "s1")).toBe(true);
  });
});

describe("moving files and folders", () => {
  beforeEach(async () => {
    await setDoc(doc(gregory.db, "fileFolders", "a"), { name: "Vendors", parentId: null });
    await setDoc(doc(gregory.db, "fileFolders", "b"), { name: "Kebun", parentId: "a" });
    await setDoc(doc(gregory.db, "fileFolders", "c"), { name: "Quotes", parentId: "b" });
    await setDoc(doc(gregory.db, "weddingFiles", "f1"), { name: "Quote.pdf", folderId: "c" });
  });

  it("moves a folder with undo, but never inside itself", async () => {
    const moved = await moveFolder("c", null, g());
    expect((await read("fileFolders", "c"))?.parentId).toBeNull();
    await moved.undo();
    expect((await read("fileFolders", "c"))?.parentId).toBe("b");

    await expect(moveFolder("a", "c", g())).rejects.toMatchObject({ code: "failed" });
    await expect(moveFolder("a", "a", g())).rejects.toMatchObject({ code: "failed" });
    await expect(moveFolder("b", "gone", g())).rejects.toMatchObject({ code: "missing" });
    expect((await read("fileFolders", "a"))?.parentId).toBeNull();
  });

  it("never makes a loop when both partners move folders into each other at once", async () => {
    await setDoc(doc(gregory.db, "fileFolders", "x"), { name: "Venues", parentId: null });
    await Promise.allSettled([moveFolder("a", "x", g()), moveFolder("x", "c", b())]);
    const parentOf = async (id: string) => (await read("fileFolders", id))?.parentId ?? null;
    // Walk up from each folder: the top is always reached.
    for (const start of ["a", "b", "c", "x"]) {
      const seen = new Set<string>();
      let at: string | null = start;
      while (at !== null) {
        expect(seen.has(at)).toBe(false);
        seen.add(at);
        at = await parentOf(at);
      }
    }
  });

  it("moves a file with undo", async () => {
    const moved = await moveFile("f1", "a", b());
    expect((await read("weddingFiles", "f1"))?.folderId).toBe("a");
    await moved.undo();
    expect((await read("weddingFiles", "f1"))?.folderId).toBe("c");
  });

  it("won't undo a file move after the partner moved it again", async () => {
    const moved = await moveFile("f1", "a", g());
    await moveFile("f1", "b", b());
    await expect(moved.undo()).rejects.toMatchObject({ code: "changed" });
    expect((await read("weddingFiles", "f1"))?.folderId).toBe("b");
  });
});

describe("folders and a file's details in Files", () => {
  beforeEach(async () => {
    await setDoc(doc(gregory.db, "fileFolders", "a"), { name: "Vendors", parentId: null });
    await setDoc(doc(gregory.db, "fileFolders", "b"), { name: "Kebun", parentId: "a" });
    await setDoc(doc(gregory.db, "weddingFiles", "f1"), { name: "Quote.pdf", folderId: "b", category: "Quote", description: "" });
  });

  it("makes a folder with the id it is given, so a retry never makes two", async () => {
    await createFolder("  Rings ", "a", { ...g(), id: "r1" });
    await createFolder("Rings", "a", { ...g(), id: "r1" });
    expect(await read("fileFolders", "r1")).toMatchObject({ name: "Rings", parentId: "a" });
    const all = await getDocs(collection(gregory.db, "fileFolders"));
    expect(all.docs.filter((d) => d.get("name") === "Rings")).toHaveLength(1);
  });

  it("won't make a folder inside one the partner just deleted (P5-S10)", async () => {
    await setDoc(doc(gregory.db, "fileFolders", "e"), { name: "Empty", parentId: "a" });
    await deleteFolder("e", b());
    await expect(createFolder("Rings", "e", { ...g(), id: "r2" })).rejects.toMatchObject({ code: "missing" });
    expect(await exists("fileFolders", "r2")).toBe(false);
  });

  it("renames a folder with undo, but not over the partner's later rename", async () => {
    const renamed = await renameFolder("b", " Garden ", g());
    expect(renamed.changed).toBe(true);
    expect((await read("fileFolders", "b"))?.name).toBe("Garden");
    await renamed.undo();
    expect((await read("fileFolders", "b"))?.name).toBe("Kebun");

    const again = await renameFolder("b", "Garden", g());
    await renameFolder("b", "Courtyard", b());
    await expect(again.undo()).rejects.toMatchObject({ code: "changed" });
    expect((await read("fileFolders", "b"))?.name).toBe("Courtyard");

    expect((await renameFolder("b", "Courtyard", g())).changed).toBe(false);
    await expect(renameFolder("gone", "X", g())).rejects.toMatchObject({ code: "missing" });
  });

  it("deletes an empty folder with undo, and refuses one that holds a folder or a file", async () => {
    await expect(deleteFolder("a", g())).rejects.toMatchObject({ code: "failed" });
    await expect(deleteFolder("b", g())).rejects.toMatchObject({ code: "failed" });
    expect(await exists("fileFolders", "a")).toBe(true);
    expect(await exists("fileFolders", "b")).toBe(true);

    await setDoc(doc(gregory.db, "fileFolders", "e"), { name: "Empty", parentId: "a", note: "kept" });
    const removed = await deleteFolder("e", g());
    expect(await exists("fileFolders", "e")).toBe(false);
    await removed.undo();
    expect(await read("fileFolders", "e")).toMatchObject({ name: "Empty", parentId: "a", note: "kept" });
  });

  it("won't undo a folder move after the partner moved it again", async () => {
    await setDoc(doc(gregory.db, "fileFolders", "z"), { name: "Z", parentId: null });
    const moved = await moveFolder("b", "z", g());
    await moveFolder("b", null, b());
    await expect(moved.undo()).rejects.toMatchObject({ code: "changed" });
    expect((await read("fileFolders", "b"))?.parentId).toBeNull();
  });

  it("changes a file's name, category and description, each with an undo that respects later edits", async () => {
    const renamed = await setFileField("f1", "name", " Final quote.pdf ", g());
    expect((await read("weddingFiles", "f1"))?.name).toBe("Final quote.pdf");
    await renamed.undo();
    expect((await read("weddingFiles", "f1"))?.name).toBe("Quote.pdf");

    await setFileField("f1", "category", "Contract", g());
    await setFileField("f1", "description", "Signed on Friday", g());
    expect(await read("weddingFiles", "f1")).toMatchObject({ category: "Contract", description: "Signed on Friday" });

    const first = await setFileField("f1", "name", "A.pdf", g());
    await setFileField("f1", "name", "B.pdf", b());
    await expect(first.undo()).rejects.toMatchObject({ code: "changed" });
    expect((await read("weddingFiles", "f1"))?.name).toBe("B.pdf");

    expect((await setFileField("f1", "name", "B.pdf", g())).changed).toBe(false);
  });
});

