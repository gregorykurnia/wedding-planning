import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { bookingsFrom, isVendorBooked, isVenueBooked } from "@/lib/model/bookings";
import { byFunder } from "@/lib/model/money";
import { bookingMark, vendorFromDoc, venueFromDoc } from "@/lib/data/adapters/bookings";
import { fundersFrom, funderFromDoc, LEGACY_FUNDERS } from "@/lib/data/adapters/funders";
import { finalistFromDoc, MAIN_PACKAGE_ID } from "@/lib/data/adapters/shortlist";
import { guestFromDoc, numberGuests } from "@/lib/data/adapters/guests";
import { fileFromDoc, filesForRecord, recordRef } from "@/lib/data/adapters/files";
import { whatIfFromDoc } from "@/lib/data/adapters/what-if";

const ts = (ms: number) => Timestamp.fromMillis(ms);

describe("bookings: the booking field or the old status", () => {
  it("reads an old vendor at Chosen as booked, and a new one by its booking field", () => {
    const old = vendorFromDoc("v1", { name: "A", contractStatus: "Chosen" });
    expect(old).not.toHaveProperty("booking");
    expect(isVendorBooked(old)).toBe(true);

    const removed = vendorFromDoc("v2", {
      name: "B",
      contractStatus: "Chosen",
      booking: { on: "2026-09-01", from: "vendor", removed: true },
    });
    expect(isVendorBooked(removed)).toBe(false);

    const notBooked = vendorFromDoc("v3", { name: "C", contractStatus: "Chosen", booking: null });
    expect(isVendorBooked(notBooked)).toBe(false);

    const direct = vendorFromDoc("v4", {
      name: "D",
      contractStatus: "List",
      booking: { on: null, from: "direct", removed: false },
    });
    expect(isVendorBooked(direct)).toBe(true);
    expect(bookingsFrom([direct], [])[0]).toMatchObject({ direct: true, from: "direct" });
  });

  it("reads an old venue at Booked as booked, its price from budgetEstimate until it has an agreed price", () => {
    const old = venueFromDoc("p1", { name: "Bukit", status: "Booked", budgetEstimate: 300 });
    expect(isVenueBooked(old)).toBe(true);
    expect(bookingsFrom([], [old])[0]).toMatchObject({ price: 300, estimate: 300 });

    const agreed = venueFromDoc("p2", {
      name: "Lawn",
      status: "Booked",
      budgetEstimate: 300,
      agreedPrice: 280,
      booking: { on: "2026-05-01", from: "venue", removed: false },
    });
    expect(bookingsFrom([], [agreed])[0]).toMatchObject({ price: 280, estimate: 300, bookedOn: "2026-05-01" });
  });

  it("keeps a missing part funder missing, so it inherits the booking's", () => {
    const v = vendorFromDoc("v1", {
      name: "A",
      contractStatus: "Chosen",
      funder: "CK",
      subEntries: [
        { id: "a", name: "Deposit", totalPrice: 10, budgetSpent: 10 },
        { name: "Balance", totalPrice: 90, funder: null },
      ],
    });
    expect(v.subEntries[0]).not.toHaveProperty("funder");
    expect(v.subEntries[1]).toMatchObject({ id: "legacy-1", funder: null });
    const [b] = bookingsFrom([v], []);
    expect(b.parts.map((p) => p.funder)).toEqual(["CK", null]);
  });

  it("reads vendor fields under their new names and survives junk", () => {
    const v = vendorFromDoc("v1", {
      starred: true,
      bridestoryRating: 4.8,
      bridestoryReviewCount: 120,
      priceOptions: [{ description: "Silver", price: "x", selected: true }],
      totalPrice: "nope",
      createdAt: ts(5),
      updatedBy: "uid-bella",
    });
    expect(v).toMatchObject({
      name: "",
      category: "Other",
      keen: true,
      rating: 4.8,
      reviewers: 120,
      totalPrice: 0,
      priceOptions: [{ id: "legacy-0", description: "Silver", includes: "", price: 0, selected: true }],
      createdAt: 5,
      updatedBy: "uid-bella",
    });
    expect(bookingMark("junk")).toBeNull();
    expect(bookingMark({ from: "weird" })).toEqual({ on: null, from: "vendor", removed: false });
  });

  it("reads payments with ids", () => {
    const v = vendorFromDoc("v1", {
      payments: [{ id: "pay1", amount: 50, paidOn: "2026-01-02", funder: "CK", receiptFileId: null }],
    });
    expect(v.payments).toEqual([
      { id: "pay1", amount: 50, paidOn: "2026-01-02", funder: "CK", receiptFileId: null },
    ]);
  });
});

describe("funders by id", () => {
  it("stands in the four old funders until the collection is seeded", () => {
    expect(fundersFrom([])).toEqual(LEGACY_FUNDERS);
  });

  it("reads the collection in its own order, ids unchanged", () => {
    const list = fundersFrom([
      funderFromDoc("Bella Fam", { name: "Bella's family", order: 3 }),
      funderFromDoc("CK", { name: "CK", order: 0 }),
      funderFromDoc("x9", { name: "Grandma", order: 4 }),
    ]);
    expect(list).toEqual([
      { id: "CK", name: "CK" },
      { id: "Bella Fam", name: "Bella's family" },
      { id: "x9", name: "Grandma" },
    ]);
  });

  it("counts costs of a funder that's no longer listed under Not assigned", () => {
    const v = vendorFromDoc("v1", { contractStatus: "Chosen", funder: "Gone", totalPrice: 100 });
    const rows = byFunder(bookingsFrom([v], []), fundersFrom([]));
    expect(rows.at(-1)).toMatchObject({ id: null, price: 100 });
  });
});

describe("shortlist: main package and the preferred one", () => {
  const doc = {
    name: "Lumina",
    type: "Photos and Videos",
    price: 15,
    priceDescription: "Full day",
    subEntries: [{ id: "k1", name: "Half day", price: 9, priceDescription: "4 hours" }],
  };

  it("reads the top-level price as package `main`, first", () => {
    const f = finalistFromDoc("s1", doc);
    expect(f.packages.map((p) => [p.id, p.price])).toEqual([
      [MAIN_PACKAGE_ID, 15],
      ["k1", 9],
    ]);
    expect(f.preferredPackageId).toBe(MAIN_PACKAGE_ID);
    expect(f.category).toBe("Photos and Videos");
    expect(f.sourceVendorId).toBeNull();
  });

  it("uses preferredPackageId when it names a package, otherwise main", () => {
    expect(finalistFromDoc("s1", { ...doc, preferredPackageId: "k1" }).preferredPackageId).toBe("k1");
    expect(finalistFromDoc("s1", { ...doc, preferredPackageId: "gone" }).preferredPackageId).toBe("main");
  });

  it("reads where a finalist moved to", () => {
    expect(finalistFromDoc("s1", { ...doc, movedTo: { kind: "vendor", id: "v1" } }).movedTo).toEqual({
      kind: "vendor",
      id: "v1",
    });
    expect(finalistFromDoc("s1", { ...doc, movedTo: { kind: "x", id: "v1" } }).movedTo).toBeNull();
  });
});

describe("guest numbers: stored, or creation order", () => {
  it("numbers old guests in creation order after the highest stored number", () => {
    const list = numberGuests([
      guestFromDoc("c", { name: "C", createdAt: ts(30) }),
      guestFromDoc("a", { name: "A", number: 7, createdAt: ts(10) }),
      guestFromDoc("b", { name: "B", createdAt: ts(20) }),
      guestFromDoc("pending", { name: "Just added" }),
    ]);
    expect(list.map((g) => [g.id, g.number, g.numberStored])).toEqual([
      ["c", 9, false],
      ["a", 7, true],
      ["b", 8, false],
      ["pending", 10, false],
    ]);
  });

  it("starts at 1 when nothing is numbered", () => {
    const list = numberGuests([guestFromDoc("a", { createdAt: ts(2) }), guestFromDoc("b", { createdAt: ts(1) })]);
    expect(list.map((g) => g.number)).toEqual([2, 1]);
  });

  it("reads unknown stored values as the defaults", () => {
    const [g] = numberGuests([guestFromDoc("a", { rsvpStatus: "maybe", eventType: "Party", plusOnes: "2" })]);
    expect(g).toMatchObject({ rsvpStatus: "pending", eventType: "Both", plusOnes: 0 });
  });
});

describe("files on a record: recordRef or legacy arrays", () => {
  const files = [
    fileFromDoc("f2", { name: "Contract", url: "u2", recordRef: { kind: "vendor", id: "v1" }, createdAt: ts(2) }),
    fileFromDoc("f1", { name: "Quote", url: "u1", recordRef: { kind: "vendor", id: "v1" }, createdAt: ts(1) }),
    fileFromDoc("f3", { name: "Other", url: "u3", recordRef: { kind: "vendor", id: "v2" } }),
    fileFromDoc("f4", { name: "Part receipt", url: "u4", recordRef: { kind: "booking", id: "vendor-v1", partId: "p1" } }),
  ];

  it("shows Files' own first, then legacy files not imported yet, never twice", () => {
    const shown = filesForRecord([{ kind: "vendor", id: "v1" }], files, [
      { name: "Quote (old copy)", url: "u1" },
      { name: "Menu", url: "u9" },
      { name: "Menu again", url: "u9" },
    ]);
    expect(shown).toEqual([
      { id: "f1", name: "Quote", url: "u1" },
      { id: "f2", name: "Contract", url: "u2" },
      { id: null, name: "Menu", url: "u9" },
    ]);
  });

  it("matches a part only with its part id, and a booking can include its vendor's files", () => {
    expect(filesForRecord([{ kind: "booking", id: "vendor-v1", partId: "p1" }], files, []).map((f) => f.id)).toEqual(["f4"]);
    expect(filesForRecord([{ kind: "booking", id: "vendor-v1" }], files, [])).toEqual([]);
    expect(
      filesForRecord([{ kind: "booking", id: "vendor-v1" }, { kind: "vendor", id: "v1" }], files, []).map((f) => f.id),
    ).toEqual(["f1", "f2"]);
  });

  it("ignores a malformed recordRef", () => {
    expect(recordRef({ kind: "guest", id: "g1" })).toBeNull();
    expect(recordRef({ kind: "vendor" })).toBeNull();
  });
});

describe("what-if items", () => {
  it("reads the new item funder and treats old null part funders as the item's", () => {
    const w = whatIfFromDoc("w1", {
      name: "Live band",
      totalPrice: 5,
      funder: "Bella",
      subEntries: [{ id: "a", name: "Band", totalPrice: 4, funder: null }],
    });
    expect(w.funder).toBe("Bella");
    expect(w.subEntries?.[0]).not.toHaveProperty("funder");
  });
});

describe("record folders and Cloudinary addresses", () => {
  it("names the folder path after the record and its part", async () => {
    const { recordFolderPath } = await import("@/lib/data/adapters/files");
    expect(recordFolderPath({ kind: "vendor", id: "v1" }, "Kebun Bunga Atelier")).toEqual(["Vendors", "Kebun Bunga Atelier"]);
    expect(recordFolderPath({ kind: "booking", id: "vendor-v1", partId: "p1" }, "Villa Samaya", "Deposit")).toEqual([
      "Bookings",
      "Villa Samaya",
      "Deposit",
    ]);
    expect(recordFolderPath({ kind: "finalist", id: "s1" }, "  ")).toEqual(["Shortlist", "Untitled"]);
  });

  it("reads the cloud, resource type and public id from a delivery URL", async () => {
    const { cloudinaryAsset } = await import("@/lib/data/adapters/files");
    expect(cloudinaryAsset("https://res.cloudinary.com/demo/image/upload/v1712345678/wedding/quote_ab12.jpg")).toEqual({
      cloudName: "demo",
      resourceType: "image",
      publicId: "wedding/quote_ab12",
    });
    expect(cloudinaryAsset("https://res.cloudinary.com/demo/raw/upload/v1/contract%20final.pdf")).toEqual({
      cloudName: "demo",
      resourceType: "raw",
      publicId: "contract final.pdf",
    });
    expect(cloudinaryAsset("https://res.cloudinary.com/demo/image/upload/c_fill,w_200/v99/a/b.png")).toEqual({
      cloudName: "demo",
      resourceType: "image",
      publicId: "a/b",
    });
    expect(cloudinaryAsset("https://example.com/x.pdf")).toBeNull();
    // Only plain uploads: a private or authenticated asset is never guessed at.
    expect(cloudinaryAsset("https://res.cloudinary.com/demo/image/authenticated/v1/a.png")).toBeNull();
    expect(cloudinaryAsset("https://res.cloudinary.com/demo/image/upload/a.png")).toBeNull();
  });
});
