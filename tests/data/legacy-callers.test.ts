import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
import { TEST_ACCOUNTS } from "../e2e/emulator-config";
import { clearFirestore, closeClient, makeClient, signIn, warmUp, type Partner } from "./emulator";

// The old UI's helpers use the app's own database from @/lib/firebase. Here
// that is Gregory's emulator client; Bella writes through a second client.
vi.mock("@/lib/firebase", async () => {
  const { makeClient } = await import("./emulator");
  const client = makeClient("app-default");
  return { app: client.app, auth: client.auth, db: client.db, isFirebaseConfigured: true };
});

const { auth, db, app } = await import("@/lib/firebase");
const { addVendorSubEntry, updateVendorSubEntry, removeVendorSubEntry, addVendorSubEntryFile } =
  await import("@/lib/collections/vendors");
const { updateVendorPriceOption, selectVendorPriceOption, removeVendorPriceOption, addVendorPriceOption } =
  await import("@/lib/collections/vendors");
const { updateShortlistSubEntry } = await import("@/lib/collections/shortlist");
const { updateSubtask, addSubtask } = await import("@/lib/collections/todos");
const master = await import("@/lib/collections/master-list");
const { updateElement } = await import("@/lib/data/array-ops");

let bella: Partner;

beforeAll(async () => {
  await signInWithEmailAndPassword(auth!, TEST_ACCOUNTS[0].email, TEST_ACCOUNTS[0].password);
  bella = await signIn(makeClient(), TEST_ACCOUNTS[1]);
  await Promise.all([warmUp({ db: db!, uid: auth!.currentUser!.uid }), warmUp(bella)]);
});

afterAll(async () => {
  await closeClient(bella);
  await closeClient({ app: app!, db: db! });
});

beforeEach(async () => {
  await clearFirestore();
});

const data = async (col: string, id: string) => (await getDoc(doc(db!, col, id))).data()!;

// A stale copy, as the old screens hold between snapshots: the helpers must not
// write it back over the partner's newer change.
const staleVendor = {
  id: "v1",
  funder: "CK",
  subEntries: [] as never[],
  priceOptions: [] as never[],
} as never;

describe("old booking parts helpers", () => {
  beforeEach(async () => {
    await setDoc(doc(db!, "vendors", "v1"), {
      name: "Dapur Lestari",
      funder: "CK",
      priceOptions: [
        { id: "o1", description: "Silver", price: 100, selected: true },
        { id: "o2", description: "Gold", price: 200, selected: false },
      ],
      subEntries: [
        { id: "p1", name: "Deposit", funder: "CK", totalPrice: 10, budgetSpent: 10, nextTargetDate: null, nextAction: "", files: [] },
        // An old part saved without an id or funder.
        { name: "Balance", totalPrice: 90, budgetSpent: 0, nextTargetDate: null, nextAction: "" },
      ],
    });
  });

  it("edits one part from a stale copy without dropping the partner's change to another", async () => {
    await updateElement("vendors", "v1", "subEntries", "legacy-1", { budgetSpent: 30 }, { db: bella.db });
    await updateVendorSubEntry(staleVendor, "p1", { name: "Down payment" });
    const stored = await data("vendors", "v1");
    expect(stored.subEntries[0]).toMatchObject({ id: "p1", name: "Down payment" });
    expect(stored.subEntries[1]).toMatchObject({ id: "legacy-1", name: "Balance", budgetSpent: 30 });
    // The legacy part still has no funder key, so it keeps inheriting the booking's.
    expect(stored.subEntries[1]).not.toHaveProperty("funder");
  });

  it("adds, attaches a file to and removes parts", async () => {
    await addVendorSubEntry(staleVendor);
    await addVendorSubEntryFile(staleVendor, "p1", { name: "receipt.pdf", url: "https://x/receipt.pdf" });
    await removeVendorSubEntry(staleVendor, "legacy-1");
    const stored = await data("vendors", "v1");
    expect(stored.subEntries.map((s: { name: string }) => s.name)).toEqual(["Deposit", "New sub-entry"]);
    expect(stored.subEntries[1].funder).toBe("CK");
    expect(stored.subEntries[0].files).toEqual([{ name: "receipt.pdf", url: "https://x/receipt.pdf" }]);
  });

  it("changes price options by id against the latest array", async () => {
    await updateElement("vendors", "v1", "priceOptions", "o2", { price: 250 }, { db: bella.db });
    await updateVendorPriceOption(staleVendor, "o1", { description: "Silver plus" });
    await selectVendorPriceOption(staleVendor, "o2");
    let stored = await data("vendors", "v1");
    expect(stored.priceOptions).toEqual([
      { id: "o1", description: "Silver plus", price: 100, selected: false },
      { id: "o2", description: "Gold", price: 250, selected: true },
    ]);

    await removeVendorPriceOption(staleVendor, "o2");
    stored = await data("vendors", "v1");
    expect(stored.priceOptions).toEqual([{ id: "o1", description: "Silver plus", price: 100, selected: true }]);

    await addVendorPriceOption(staleVendor);
    stored = await data("vendors", "v1");
    expect(stored.priceOptions).toHaveLength(2);
    expect(stored.priceOptions[1]).toMatchObject({ selected: false });
  });
});

describe("old package and step helpers", () => {
  it("edits one package from a stale copy", async () => {
    await setDoc(doc(db!, "shortlist", "s1"), {
      name: "Lumina",
      subEntries: [
        { id: "k1", name: "Basic", price: 1 },
        { id: "k2", name: "Full day", price: 2 },
      ],
    });
    await updateElement("shortlist", "s1", "subEntries", "k2", { price: 3 }, { db: bella.db });
    await updateShortlistSubEntry({ id: "s1", subEntries: [] } as never, "k1", { name: "Basic plus" });
    const stored = await data("shortlist", "s1");
    expect(stored.subEntries).toEqual([
      { id: "k1", name: "Basic plus", price: 1 },
      { id: "k2", name: "Full day", price: 3 },
    ]);
  });

  it("ticks one step while the partner adds another", async () => {
    await setDoc(doc(db!, "todos", "t1"), {
      title: "Tasting",
      subtasks: [{ id: "s1", title: "Book", notes: "", dueDate: null, done: false }],
    });
    const stale = { id: "t1", subtasks: [] } as never;
    await Promise.all([updateSubtask(stale, "s1", { done: true }), addSubtask(stale)]);
    const stored = await data("todos", "t1");
    expect(stored.subtasks).toHaveLength(2);
    expect(stored.subtasks[0]).toMatchObject({ id: "s1", done: true });
  });
});

describe("master list order", () => {
  async function rows() {
    const snap = await getDocs(query(collection(db!, "masterListItems"), orderBy("sortOrder", "asc")));
    return snap.docs.map((d) => ({ id: d.id, sortOrder: d.data().sortOrder as number }));
  }

  it("fails loudly when a row in a move was removed", async () => {
    await master.ensureMasterListInitialized();
    const [first, second] = await rows();
    await master.deleteMasterListItem(second.id);
    await expect(
      master.moveMasterListItem(first.id, second.id, "down", first.sortOrder, second.sortOrder),
    ).rejects.toThrow(/removed/);
  });

  it("renumbers when inserting below a row leaves no room, keeping the order", async () => {
    await master.ensureMasterListInitialized();
    const [first, second] = await rows();
    // Squeeze the first two rows so there is no room between them.
    await setDoc(doc(db!, "masterListItems", second.id), { sortOrder: first.sortOrder + 1e-9 }, { merge: true });
    const before = (await rows()).map((r) => r.id);

    const [added] = await master.addMasterListItems(1, first.id);

    const after = await rows();
    expect(after.map((r) => r.id)).toEqual([before[0], added, ...before.slice(1)]);
    const gaps = after.slice(1).map((r, i) => r.sortOrder - after[i].sortOrder);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(master.MIN_SORT_GAP);
    const meta = await data("masterListMeta", "initialization");
    expect(meta.nextSortOrder).toBeGreaterThan(after.at(-1)!.sortOrder);
  });

  it("renumbers to whole numbers in the current order", async () => {
    await master.ensureMasterListInitialized();
    const [first, second, third] = await rows();
    await setDoc(doc(db!, "masterListItems", third.id), { sortOrder: first.sortOrder + 0.5 }, { merge: true });
    await master.renumberMasterList();
    const after = await rows();
    expect(after.slice(0, 3).map((r) => r.id)).toEqual([first.id, third.id, second.id]);
    expect(after.map((r) => r.sortOrder)).toEqual(after.map((_, i) => i));
  });
});
