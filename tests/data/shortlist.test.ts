import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  addFinalist,
  addPackage,
  bookFinalist,
  leanTowardsPackage,
  moveFinalistToVendors,
  removeFinalist,
  removePackage,
  setFinalistField,
  updatePackage,
} from "@/lib/data/shortlist";
import { finalistFromDoc } from "@/lib/data/adapters/shortlist";
import { WriteError } from "@/lib/data/write-error";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

// Task 4.13: "Add a finalist" on the Shortlist, against the emulators (guide §5.13, F21).

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

async function read(id: string) {
  return (await getDoc(doc(gregory.db, "shortlist", id))).data();
}

const input = (over: Partial<Parameters<typeof addFinalist>[0]> = {}) => ({
  id: "f-new",
  name: "  Lumina Wedding Photography ",
  category: "Photos and Videos",
  packageName: " Full day ",
  price: 24_000_000 as number | null,
  ...over,
});

/** The activity entries are written without waiting, so poll for them. */
async function activityOf(kind: string) {
  for (let i = 0; i < 40; i++) {
    const snap = await getDocs(query(collection(gregory.db, "activity"), where("kind", "==", kind)));
    if (!snap.empty) return snap.docs.map((d) => d.data());
    await new Promise((r) => setTimeout(r, 100));
  }
  return [];
}

describe("addFinalist", () => {
  it("stores the finalist the way the old screens read it, its first package as its own price", async () => {
    await addFinalist(input(), g());
    const stored = await read("f-new");
    expect(stored).toMatchObject({
      name: "Lumina Wedding Photography",
      type: "Photos and Videos",
      price: 24_000_000,
      priceDescription: "Full day",
      subEntries: [],
      sourceVendorId: null,
    });
    const finalist = finalistFromDoc("f-new", stored!);
    expect(finalist.packages).toEqual([expect.objectContaining({ id: "main", name: "Full day", price: 24_000_000 })]);
    expect(finalist.sourceVendorId).toBeNull();
    expect(await activityOf("finalist.added")).toEqual([
      expect.objectContaining({ params: { name: "Lumina Wedding Photography" }, target: { kind: "finalist", id: "f-new" } }),
    ]);
  });

  it("takes a name alone: no package yet", async () => {
    await addFinalist(input({ packageName: "", price: null }), g());
    expect(await read("f-new")).toMatchObject({ price: 0, priceDescription: "" });
  });

  it("names a package that only has a price", async () => {
    await addFinalist(input({ packageName: "", price: 5_000_000 }), g());
    expect(await read("f-new")).toMatchObject({ price: 5_000_000, priceDescription: "Package" });
  });

  it("writes the same record when it is tried again, so a retry never duplicates", async () => {
    await addFinalist(input(), g());
    await addFinalist(input({ packageName: "Tried again" }), g());
    const all = await getDocs(collection(gregory.db, "shortlist"));
    expect(all.size).toBe(1);
    expect(all.docs[0].data().priceDescription).toBe("Tried again");
  });

  it("undo removes the finalist again", async () => {
    const { undo } = await addFinalist(input(), g());
    await undo();
    expect((await getDoc(doc(gregory.db, "shortlist", "f-new"))).exists()).toBe(false);
    expect(await activityOf("finalist.removed")).toHaveLength(1);
  });

  it("refuses to undo once the finalist has grown, and leaves it as it is", async () => {
    const { undo } = await addFinalist(input(), g());
    await updateDoc(doc(bella.db, "shortlist", "f-new"), { notes: "They offered a discount" });
    await expect(undo()).rejects.toMatchObject({ code: "changed" });
    await expect(undo()).rejects.toBeInstanceOf(WriteError);
    expect(await read("f-new")).toMatchObject({ name: "Lumina Wedding Photography" });
  });
});

// Task 4.14: a finalist's own screen (guide §5.14): its fields, its packages, Book it and removal.

const arka = (over: Record<string, unknown> = {}) => ({
  name: "Arka Visual",
  type: "Photos and Videos",
  price: 15_000_000,
  priceDescription: "Full day",
  subEntries: [],
  ...over,
});

const newPackage = (over: Partial<Parameters<typeof addPackage>[1]> = {}) => ({
  id: "k-new",
  name: "  Half day ",
  price: 9_000_000,
  includes: "Four hours",
  reviewers: 12 as number | null,
  step: "Send the quote",
  notes: "Ask about travel",
  ...over,
});

describe("setFinalistField", () => {
  it("saves each field under the name the old screens read", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), arka());
    await setFinalistField("s1", "contactName", "Bu Ayu", g());
    await setFinalistField("s1", "contactPhone", "0812", g());
    await setFinalistField("s1", "reviewers", 120, g());
    await setFinalistField("s1", "followers", 12_300, g());
    await setFinalistField("s1", "step", "Call back", g());
    await setFinalistField("s1", "notes", "Ask about the arch", g());
    expect(await read("s1")).toMatchObject({
      contactName: "Bu Ayu",
      contactPhone: "0812",
      bridestoryReviewers: 120,
      igFollowers: 12_300,
      nextAction: "Call back",
      notes: "Ask about the arch",
    });
    await setFinalistField("s1", "reviewers", null, g());
    expect((await read("s1"))?.bridestoryReviewers).toBeNull();
  });
});

describe("addPackage", () => {
  it("stores the package as the old screens store one, and makes the first the one we lean towards", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), arka({ price: 0, priceDescription: "" }));
    await addPackage("s1", newPackage(), g());
    const stored = await read("s1");
    expect(stored?.subEntries).toEqual([
      expect.objectContaining({
        id: "k-new",
        name: "Half day",
        type: "Photos and Videos",
        price: 9_000_000,
        priceDescription: "Half day",
        includes: "Four hours",
        bridestoryReviewers: 12,
        nextAction: "Send the quote",
        notes: "Ask about travel",
        files: [],
      }),
    ]);
    expect(stored?.preferredPackageId).toBe("k-new");
  });

  it("leaves the leaning package alone when there already is one, and adds the same id only once", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), arka({ preferredPackageId: "main" }));
    await addPackage("s1", newPackage(), g());
    await addPackage("s1", newPackage({ name: "Tried again" }), g());
    const stored = await read("s1");
    expect(stored?.subEntries).toHaveLength(1);
    expect((stored?.subEntries as { name: string }[])[0].name).toBe("Half day");
    expect(stored?.preferredPackageId).toBe("main");
  });

  it("undo takes the package out again, and refuses once the packages changed", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), arka({ price: 0, priceDescription: "" }));
    const { undo } = await addPackage("s1", newPackage(), g());
    await undo();
    expect((await read("s1"))?.subEntries).toEqual([]);

    const again = await addPackage("s1", newPackage({ id: "k2" }), g());
    await addPackage("s1", newPackage({ id: "k3" }), b());
    await expect(again.undo()).rejects.toMatchObject({ code: "changed" });
    expect(((await read("s1"))?.subEntries as unknown[]).length).toBe(2);
  });
});

describe("updatePackage", () => {
  it("changes the finalist's own price by its top-level fields", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), arka());
    await updatePackage("s1", "main", { name: " Full styling ", price: 16_000_000, includes: "Two people" }, g());
    expect(await read("s1")).toMatchObject({ priceDescription: "Full styling", price: 16_000_000, includes: "Two people" });
  });

  it("changes one stored package and leaves the others, keeping the old description with the name", async () => {
    await setDoc(
      doc(gregory.db, "shortlist", "s1"),
      arka({
        subEntries: [
          { id: "k1", name: "Half day", price: 9, priceDescription: "Half day" },
          { id: "k2", name: "Evening", price: 5, priceDescription: "From 6 pm" },
        ],
      }),
    );
    await updatePackage("s1", "k1", { name: "Short day", price: 10, reviewers: 4, step: "Visit", notes: "Nice", includes: "An album" }, g());
    await updatePackage("s1", "k2", { name: "Late" }, b());
    const [k1, k2] = (await read("s1"))?.subEntries as Record<string, unknown>[];
    expect(k1).toMatchObject({
      name: "Short day",
      priceDescription: "Short day",
      price: 10,
      bridestoryReviewers: 4,
      nextAction: "Visit",
      notes: "Nice",
      includes: "An album",
    });
    // A description that someone wrote apart from the name stays as it was.
    expect(k2).toMatchObject({ name: "Late", priceDescription: "From 6 pm", price: 5 });
  });

  it("says the package is gone when the partner removed it", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), arka());
    await expect(updatePackage("s1", "k9", { price: 1 }, g())).rejects.toMatchObject({ code: "missing" });
  });
});

describe("leaning and removing a package", () => {
  const withTwo = () =>
    setDoc(
      doc(gregory.db, "shortlist", "s1"),
      arka({ subEntries: [{ id: "k1", name: "Half day", price: 9 }], preferredPackageId: "main" }),
    );

  it("leans towards one package, and undo puts the earlier one back", async () => {
    await withTwo();
    const done = await leanTowardsPackage("s1", "k1", g());
    expect((await read("s1"))?.preferredPackageId).toBe("k1");
    await done.undo();
    expect((await read("s1"))?.preferredPackageId).toBe("main");
    expect((await leanTowardsPackage("s1", "main", g())).changed).toBe(false);
  });

  it("removes a stored package at the same place on undo", async () => {
    await withTwo();
    const done = await removePackage("s1", "k1", g());
    expect((await read("s1"))?.subEntries).toEqual([]);
    await done.undo();
    expect(((await read("s1"))?.subEntries as { id: string }[]).map((p) => p.id)).toEqual(["k1"]);
  });

  it("removes the finalist's own price by clearing it, and undo brings it back", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), arka({ includes: "Two people" }));
    const done = await removePackage("s1", "main", g());
    expect(await read("s1")).toMatchObject({ price: 0, priceDescription: "", includes: "" });
    await done.undo();
    expect(await read("s1")).toMatchObject({ price: 15_000_000, priceDescription: "Full day", includes: "Two people" });
  });
});

describe("Book it, Move into Vendors and removing a finalist", () => {
  it("books a finalist that has no package at all, without a price; undo removes the new vendor", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), arka({ price: 0, priceDescription: "" }));
    const booked = await bookFinalist("s1", null, "2026-10-14", { ...g(), vendorId: "new1" });
    const vendor = (await getDoc(doc(gregory.db, "vendors", "new1"))).data();
    expect(vendor).toMatchObject({ name: "Arka Visual", totalPrice: 0, estimate: 0, booking: { from: "finalist", removed: false } });
    expect(vendor?.priceOptions).toEqual([]);
    expect(await read("s1")).toMatchObject({ movedTo: { kind: "booking", id: "vendor-new1" } });
    await booked.undo();
    expect((await getDoc(doc(gregory.db, "vendors", "new1"))).exists()).toBe(false);
    expect(await read("s1")).not.toHaveProperty("movedTo");
  });

  it("still says the package is gone when the one chosen was removed", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), arka());
    await expect(bookFinalist("s1", "k9", null, { ...g(), vendorId: "new1" })).rejects.toMatchObject({ code: "missing" });
  });

  it("moves into Vendors with only the real packages, what they include and the files, the leaning one chosen", async () => {
    await setDoc(
      doc(gregory.db, "shortlist", "s1"),
      arka({
        price: 0,
        priceDescription: "",
        subEntries: [{ id: "k1", name: "Half day", price: 9, priceDescription: "Half day", includes: "Four hours" }],
        preferredPackageId: "main",
        files: [{ id: "f1", name: "Quote.pdf", url: "https://example.com/q.pdf" }],
      }),
    );
    await moveFinalistToVendors("s1", { ...g(), vendorId: "new2" });
    expect((await getDoc(doc(gregory.db, "vendors", "new2"))).data()).toMatchObject({
      priceOptions: [{ id: "k1", description: "Half day", price: 9, includes: "Four hours", selected: true }],
      files: [{ id: "f1", name: "Quote.pdf", url: "https://example.com/q.pdf" }],
    });
  });

  it("removes a finalist with undo, and tells the partner's open screen", async () => {
    await setDoc(doc(gregory.db, "shortlist", "s1"), arka());
    const done = await removeFinalist("s1", g());
    expect((await getDoc(doc(gregory.db, "shortlist", "s1"))).exists()).toBe(false);
    expect(await activityOf("finalist.removed")).toEqual([
      expect.objectContaining({ params: { name: "Arka Visual" }, target: { kind: "finalist", id: "s1" } }),
    ]);
    await done.undo();
    expect((await getDoc(doc(gregory.db, "shortlist", "s1"))).exists()).toBe(true);
  });
});
