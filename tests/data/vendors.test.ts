import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addCategory } from "@/lib/data/categories";
import { addVendor, setVendorKeen } from "@/lib/data/vendors";
import { WriteError } from "@/lib/data/write-error";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

// Task 4.11: the Vendors screen's writes, against the emulators (guide §5.11).

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

const input = (over: Record<string, string> = {}) => ({
  id: "v-new",
  name: "  Bunga Melati Florist ",
  category: "Decoration",
  contactName: " Bu Melati ",
  contactPhone: "0812 3456 7890",
  notes: "Found at the wedding fair",
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

describe("addVendor", () => {
  it("adds the vendor at the first stage, with no price, in the fields both UIs read", async () => {
    await addVendor(input(), g());
    expect(await read("vendors", "v-new")).toMatchObject({
      name: "Bunga Melati Florist",
      category: "Decoration",
      confirmedType: "Decoration",
      contactName: "Bu Melati",
      contactPhone: "0812 3456 7890",
      contractStatus: "List",
      priceOptions: [],
      starred: false,
      files: [],
      subEntries: [],
      createdBy: gregory.uid,
    });
    expect(await activityOf("vendor.added")).toEqual([
      expect.objectContaining({ params: { name: "Bunga Melati Florist" }, target: { kind: "vendor", id: "v-new" } }),
    ]);
  });

  it("writes the same record when it is tried again, so a retry never duplicates", async () => {
    await addVendor(input(), g());
    await addVendor(input({ notes: "Tried again" }), g());
    const all = await getDocs(collection(gregory.db, "vendors"));
    expect(all.size).toBe(1);
    expect(all.docs[0].data().notes).toBe("Tried again");
  });

  it("undo removes the vendor again", async () => {
    const { undo } = await addVendor(input(), g());
    await undo();
    expect((await getDoc(doc(gregory.db, "vendors", "v-new"))).exists()).toBe(false);
    expect(await activityOf("vendor.removed")).toHaveLength(1);
  });

  it("refuses to undo once the vendor has grown, and leaves it as it is", async () => {
    const { undo } = await addVendor(input(), g());
    await updateDoc(doc(bella.db, "vendors", "v-new"), {
      priceOptions: [{ id: "o1", description: "Gold", price: 5_000_000, selected: true }],
    });
    await expect(undo()).rejects.toMatchObject({ code: "changed" });
    await expect(undo()).rejects.toBeInstanceOf(WriteError);
    expect(await read("vendors", "v-new")).toMatchObject({ name: "Bunga Melati Florist" });
  });
});

describe("setVendorKeen", () => {
  it("marks a vendor as one we're keen on and unmarks it", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), { name: "Kebun", starred: false });
    await setVendorKeen("v1", true, g());
    expect(await read("vendors", "v1")).toMatchObject({ starred: true, updatedBy: gregory.uid });
    await setVendorKeen("v1", false, b());
    expect(await read("vendors", "v1")).toMatchObject({ starred: false, updatedBy: bella.uid });
  });
});

describe("addCategory", () => {
  it("adds one of ours, trimmed, under the id the form made", async () => {
    expect(await addCategory("c-new", "  Henna art ", g())).toBe("Henna art");
    expect(await read("vendorCategories", "c-new")).toMatchObject({ name: "Henna art", createdBy: gregory.uid });
  });

  it("refuses a name that is taken (without regard to case), reserved, empty or too long", async () => {
    await expect(addCategory("c1", "food", g())).rejects.toThrow(/already a category called Food/);
    await expect(addCategory("c1", "other", g())).rejects.toThrow(/already a category called Other/);
    await expect(addCategory("c1", " all ", g())).rejects.toThrow(/All/);
    await expect(addCategory("c1", "  ", g())).rejects.toThrow(/Give the category a name/);
    await expect(addCategory("c1", "x".repeat(41), g())).rejects.toThrow(/40 characters/);
    expect((await getDocs(collection(gregory.db, "vendorCategories"))).size).toBe(0);
  });

  it("checks against the partner's categories, added a moment ago", async () => {
    await addCategory("c1", "Henna art", b());
    await expect(addCategory("c2", "HENNA ART", g())).rejects.toThrow(/already a category called Henna art/);
  });

  it("writes the same category when it is tried again", async () => {
    await addCategory("c1", "Henna art", g());
    // The first try landed after its timeout; the retry finds it and adds nothing.
    expect(await addCategory("c1", "Henna art", g())).toBe("Henna art");
    expect((await getDocs(collection(gregory.db, "vendorCategories"))).size).toBe(1);
    // Another category with that name is still refused.
    await expect(addCategory("c2", "Henna art", g())).rejects.toThrow(/already a category/);
  });
});
