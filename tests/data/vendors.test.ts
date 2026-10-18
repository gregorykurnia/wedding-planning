import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addCategory } from "@/lib/data/categories";
import {
  addPriceOption,
  addVendor,
  leanTowards,
  removePriceOption,
  removeVendorFromList,
  setVendorField,
  setVendorKeen,
  setVendorStage,
  updatePriceOption,
} from "@/lib/data/vendors";
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

// Task 4.12: a vendor's own screen's writes (guide §5.12, F8, F10, F16, B1, N10).

describe("the vendor screen's writes", () => {
  const seed = (over: Record<string, unknown> = {}) =>
    setDoc(doc(gregory.db, "vendors", "v1"), {
      name: "Kebun Bunga Atelier",
      category: "Decoration",
      confirmedType: "Decoration",
      contactName: "Bu Ayu",
      contactPhone: "",
      contractStatus: "Consideration",
      priceOptions: [
        { id: "o1", description: "Silver", price: 45_000_000, selected: false },
        { id: "o2", description: "Gold", price: 62_500_000, selected: true },
      ],
      notes: "",
      starred: false,
      files: [],
      subEntries: [],
      ...over,
    });

  it("saves a field by the stored names, and a category with the old confirmed type", async () => {
    await seed();
    await setVendorField("v1", "rating", 4.9, g());
    await setVendorField("v1", "reviewers", 1250, g());
    await setVendorField("v1", "category", "Food", g());
    expect(await read("vendors", "v1")).toMatchObject({
      bridestoryRating: 4.9,
      bridestoryReviewCount: 1250,
      category: "Food",
      confirmedType: "Food",
    });
  });

  it("makes the vendor a booking when Chosen, once, with the estimate from the option we lean towards", async () => {
    await seed();
    const first = await setVendorStage("v1", "Chosen", "2026-10-14", g());
    expect(first.becameBooking).toBe(true);
    expect(await read("vendors", "v1")).toMatchObject({
      contractStatus: "Chosen",
      booking: { on: "2026-10-14", from: "vendor", removed: false },
      estimate: 62_500_000,
    });

    // Chosen again, and a later stage, only move the stage.
    const again = await setVendorStage("v1", "Chosen", "2026-10-20", g());
    expect(again.becameBooking).toBe(false);
    await setVendorStage("v1", "Inquiring", "2026-10-20", g());
    expect(await read("vendors", "v1")).toMatchObject({
      contractStatus: "Inquiring",
      booking: { on: "2026-10-14", from: "vendor", removed: false },
    });
    // Back to Chosen for a booked vendor moves the stage and makes no second booking.
    expect((await setVendorStage("v1", "Chosen", "2026-10-21", g())).becameBooking).toBe(false);
    expect((await read("vendors", "v1"))?.contractStatus).toBe("Chosen");
  });

  it("undoes a stage change that made a booking", async () => {
    await seed();
    const { undo } = await setVendorStage("v1", "Chosen", "2026-10-14", g());
    await undo();
    const after = await read("vendors", "v1");
    expect(after?.contractStatus).toBe("Consideration");
    expect(after?.booking).toBeUndefined();
  });

  it("adds an option once however often it is retried, clearing the others when it is the one we lean towards", async () => {
    await seed();
    const option = { id: "o3", name: "Platinum", price: 90_000_000, includes: "Everything", leaning: true };
    const done = await addPriceOption("v1", option, g());
    await addPriceOption("v1", option, g());
    const options = (await read("vendors", "v1"))?.priceOptions;
    expect(options.map((o: { id: string; selected: boolean }) => [o.id, o.selected])).toEqual([["o1", false], ["o2", false], ["o3", true]]);
    expect(options[2]).toEqual({ id: "o3", description: "Platinum", price: 90_000_000, includes: "Everything", selected: true });

    await done.undo();
    expect((await read("vendors", "v1"))?.priceOptions.map((o: { id: string; selected: boolean }) => [o.id, o.selected])).toEqual([
      ["o1", false],
      ["o2", true],
    ]);
  });

  it("refuses to undo an add once the partner has changed the options", async () => {
    await seed();
    const done = await addPriceOption("v1", { id: "o3", name: "Platinum", price: 1, includes: "", leaning: false }, g());
    await updatePriceOption("v1", "o1", { price: 46_000_000 }, b());
    await expect(done.undo()).rejects.toMatchObject({ code: "changed" });
    expect((await read("vendors", "v1"))?.priceOptions).toHaveLength(3);
  });

  it("edits one option and leaves the others, clearing the rest when it becomes the one we lean towards", async () => {
    await seed();
    await updatePriceOption("v1", "o1", { name: " Silver plus ", price: 48_000_000, includes: "Arch" }, g());
    await updatePriceOption("v1", "o1", { leaning: true }, g());
    expect((await read("vendors", "v1"))?.priceOptions).toEqual([
      { id: "o1", description: "Silver plus", price: 48_000_000, includes: "Arch", selected: true },
      { id: "o2", description: "Gold", price: 62_500_000, selected: false },
    ]);
    await expect(updatePriceOption("v1", "gone", { price: 1 }, g())).rejects.toMatchObject({ code: "missing" });
  });

  it("leans towards one option, and has nothing to undo when it already is", async () => {
    await seed();
    const done = await leanTowards("v1", "o1", g());
    expect((await read("vendors", "v1"))?.priceOptions.map((o: { selected: boolean }) => o.selected)).toEqual([true, false]);
    await done.undo();
    expect((await read("vendors", "v1"))?.priceOptions.map((o: { selected: boolean }) => o.selected)).toEqual([false, true]);
    expect((await leanTowards("v1", "o2", g())).changed).toBe(false);
  });

  it("gives legacy options without ids a stable one the first time the list is changed", async () => {
    await seed({ priceOptions: [{ description: "Silver", price: 1, selected: false }, { description: "Gold", price: 2, selected: true }] });
    await leanTowards("v1", "legacy-0", g());
    expect((await read("vendors", "v1"))?.priceOptions.map((o: { id: string; selected: boolean }) => [o.id, o.selected])).toEqual([
      ["legacy-0", true],
      ["legacy-1", false],
    ]);
  });

  it("removes an option and puts it back at the same place", async () => {
    await seed();
    const { undo, element } = await removePriceOption("v1", "o1", g());
    expect(element?.id).toBe("o1");
    expect((await read("vendors", "v1"))?.priceOptions).toHaveLength(1);
    await undo();
    expect((await read("vendors", "v1"))?.priceOptions.map((o: { id: string }) => o.id)).toEqual(["o1", "o2"]);
  });

  it("removes a vendor that isn't a booking, and brings it back with undo", async () => {
    await seed();
    const { undo } = await removeVendorFromList("v1", g());
    expect(await read("vendors", "v1")).toBeUndefined();
    const logged = await getDocs(query(collection(gregory.db, "activity"), where("kind", "==", "vendor.removed")));
    expect(logged.docs).toHaveLength(1);
    await undo();
    expect((await read("vendors", "v1"))?.name).toBe("Kebun Bunga Atelier");
  });

  it("keeps a vendor that is a booking, as a direct booking, and undoes that", async () => {
    await seed({ contractStatus: "Chosen", totalPrice: 5_000_000, booking: { on: "2026-09-01", from: "vendor", removed: false } });
    const { undo } = await removeVendorFromList("v1", g());
    expect(await read("vendors", "v1")).toMatchObject({
      totalPrice: 5_000_000,
      booking: { on: "2026-09-01", from: "direct", removed: false },
    });
    await undo();
    expect((await read("vendors", "v1"))?.booking).toMatchObject({ from: "vendor" });
  });
});
