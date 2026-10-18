import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { splitWhatIf } from "@/lib/data/bookings";
import { addWhatIf, setWhatIfField, setWhatIfPartField } from "@/lib/data/what-if";
import { WriteError } from "@/lib/data/write-error";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

// Task 4.10: the What-if items screen's writes, against the emulators (guide §5.10).

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

const input = (over: Record<string, string | number | null> = {}) => ({
  id: "wi-new",
  name: "  Photo booth ",
  category: "Photography",
  price: 12_000_000 as number | null,
  funder: "bella" as string | null,
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

describe("addWhatIf", () => {
  it("adds the item in the fields both UIs read, with who would pay", async () => {
    await addWhatIf(input(), g());
    expect(await read("hypotheticalItems", "wi-new")).toMatchObject({
      name: "Photo booth",
      type: "Photography",
      totalPrice: 12_000_000,
      funder: "bella",
      budgetSpent: 0,
      nextTargetDate: null,
      nextAction: "",
      files: [],
      subEntries: [],
      createdBy: gregory.uid,
    });
    expect(await activityOf("whatif.added")).toEqual([
      expect.objectContaining({ params: { name: "Photo booth" }, target: { kind: "whatif", id: "wi-new" } }),
    ]);
  });

  it("saves an empty price as 0 and nobody as null", async () => {
    await addWhatIf(input({ price: null, funder: null }), g());
    expect(await read("hypotheticalItems", "wi-new")).toMatchObject({ totalPrice: 0, funder: null });
  });

  it("writes the same record when it is tried again, so a retry never duplicates", async () => {
    await addWhatIf(input(), g());
    await addWhatIf(input({ price: 15_000_000 }), g());
    const all = await getDocs(collection(gregory.db, "hypotheticalItems"));
    expect(all.size).toBe(1);
    expect(all.docs[0].data().totalPrice).toBe(15_000_000);
  });

  it("undo removes the item again", async () => {
    const { undo } = await addWhatIf(input(), g());
    await undo();
    expect((await getDoc(doc(gregory.db, "hypotheticalItems", "wi-new"))).exists()).toBe(false);
  });

  it("refuses to undo once the item has been split into parts, and leaves it as it is", async () => {
    const { undo } = await addWhatIf(input(), g());
    await splitWhatIf("wi-new", b());
    await expect(undo()).rejects.toMatchObject({ code: "changed" });
    await expect(undo()).rejects.toBeInstanceOf(WriteError);
    expect(await read("hypotheticalItems", "wi-new")).toMatchObject({ name: "Photo booth" });
  });
});

describe("setWhatIfField", () => {
  it("saves each field under the name the old screens read", async () => {
    await setDoc(doc(gregory.db, "hypotheticalItems", "w1"), { name: "Band", type: "Other", totalPrice: 1, funder: null });
    await setWhatIfField("w1", "name", "Live band", g());
    await setWhatIfField("w1", "category", "Music/DJ", g());
    await setWhatIfField("w1", "price", 40_000_000, b());
    await setWhatIfField("w1", "funder", "ck", b());
    expect(await read("hypotheticalItems", "w1")).toMatchObject({
      name: "Live band",
      type: "Music/DJ",
      totalPrice: 40_000_000,
      funder: "ck",
      updatedBy: bella.uid,
    });
    await setWhatIfField("w1", "funder", null, g());
    expect(await read("hypotheticalItems", "w1")).toMatchObject({ funder: null });
  });
});

describe("parts", () => {
  beforeEach(async () => {
    await setDoc(doc(gregory.db, "hypotheticalItems", "w1"), {
      name: "Live band",
      type: "Music/DJ",
      totalPrice: 40_000_000,
      funder: "greg",
      subEntries: [],
    });
  });

  it("a split moves the funder down into the parts, so a part can be set to Not assigned", async () => {
    const { partIds } = await splitWhatIf("w1", g());
    expect(await read("hypotheticalItems", "w1")).toMatchObject({ funder: null });
    expect((await read("hypotheticalItems", "w1"))?.subEntries.map((p: { funder: string | null }) => p.funder)).toEqual(["greg", "greg"]);

    await setWhatIfPartField("w1", partIds[1], "funder", null, g());
    expect((await read("hypotheticalItems", "w1"))?.subEntries.map((p: { funder: string | null }) => p.funder)).toEqual(["greg", null]);
  });

  it("undoes a split back to the one item with its funder, when nobody has touched the parts", async () => {
    const { undo } = await splitWhatIf("w1", g());
    await undo();
    expect(await read("hypotheticalItems", "w1")).toMatchObject({ subEntries: [], totalPrice: 40_000_000, funder: "greg" });
  });

  it("saves a part's fields inside the item as it is now, so the partner's change to another part stays", async () => {
    const { partIds } = await splitWhatIf("w1", g());
    const [first, second] = partIds;
    await Promise.all([
      setWhatIfPartField("w1", first, "name", "Deposit", g()),
      setWhatIfPartField("w1", first, "price", 10_000_000, g()),
      setWhatIfPartField("w1", second, "name", "Balance", b()),
      setWhatIfPartField("w1", second, "price", 30_000_000, b()),
      setWhatIfPartField("w1", second, "funder", "bella", b()),
    ]);
    expect((await read("hypotheticalItems", "w1"))?.subEntries).toMatchObject([
      { id: first, name: "Deposit", totalPrice: 10_000_000, funder: "greg" },
      { id: second, name: "Balance", totalPrice: 30_000_000, funder: "bella" },
    ]);
  });

  it("refuses a field of a part that is gone", async () => {
    await splitWhatIf("w1", g());
    await expect(setWhatIfPartField("w1", "nope", "name", "X", g())).rejects.toBeInstanceOf(WriteError);
  });
});
