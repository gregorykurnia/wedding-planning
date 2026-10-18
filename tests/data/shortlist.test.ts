import { collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addFinalist } from "@/lib/data/shortlist";
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
