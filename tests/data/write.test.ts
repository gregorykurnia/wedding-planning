import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  collection,
  disableNetwork,
  doc,
  enableNetwork,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import {
  addElement,
  insertAt,
  moveElement,
  removeElement,
  updateElement,
  withElementIds,
} from "@/lib/data/array-ops";
import { removeElementWithUndo, removeWithUndo, updateWithUndo } from "@/lib/data/undo";
import { create, newId, remove, set, setWriteTimeout, update, WriteError } from "@/lib/data/write";
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

afterEach(() => {
  setWriteTimeout(null);
});

const part = (id: string, name: string, totalPrice = 0, budgetSpent = 0) => ({
  id,
  name,
  funder: null,
  totalPrice,
  budgetSpent,
  nextTargetDate: null,
  nextAction: "",
  files: [],
});

async function read(p: Partner, col: string, id: string) {
  const snap = await getDoc(doc(p.db, col, id));
  return snap.data();
}

async function seedVendor(parts = [part("p1", "Deposit", 10, 10), part("p2", "Balance", 90)]) {
  await setDoc(doc(gregory.db, "vendors", "v1"), {
    name: "Dapur Lestari Catering",
    subEntries: parts,
    createdAt: Timestamp.fromMillis(1_700_000_000_000),
  });
}

describe("create, update, set, remove", () => {
  it("stamps who made and who last changed a record", async () => {
    const id = await create("vendors", { name: "Bunga Melati Florist" }, { db: gregory.db });
    let data = await read(gregory, "vendors", id);
    expect(data).toMatchObject({ name: "Bunga Melati Florist", createdBy: gregory.uid, updatedBy: gregory.uid });
    expect(data?.createdAt).toBeInstanceOf(Timestamp);

    await update("vendors", id, { notes: "Call back" }, { db: bella.db });
    data = await read(gregory, "vendors", id);
    expect(data).toMatchObject({ notes: "Call back", createdBy: gregory.uid, updatedBy: bella.uid });

    await set("vendors", id, { starred: true }, { db: gregory.db, merge: true });
    data = await read(gregory, "vendors", id);
    expect(data).toMatchObject({ name: "Bunga Melati Florist", starred: true, updatedBy: gregory.uid });

    await remove("vendors", id, { db: bella.db });
    expect(await read(gregory, "vendors", id)).toBeUndefined();
  });

  it("uses an id made on this device, so the caller knows it before the write lands", async () => {
    const id = newId("guests", { db: gregory.db });
    expect(await create("guests", { name: "Maria Goretti" }, { db: gregory.db, id })).toBe(id);
    expect(await read(bella, "guests", id)).toMatchObject({ name: "Maria Goretti" });
  });

  it("reports a missing record as `missing`", async () => {
    await expect(update("vendors", "nope", { name: "x" }, { db: gregory.db })).rejects.toMatchObject({
      code: "missing",
    });
  });
});

describe("a write that times out", () => {
  it("rejects with `timeout` and the retry writes the same id once", async () => {
    setWriteTimeout(300);
    await disableNetwork(gregory.db);
    let failure: WriteError | undefined;
    try {
      await create("guests", { name: "Wayan" }, { db: gregory.db, id: "guest-retry" });
    } catch (err) {
      failure = err as WriteError;
    } finally {
      await enableNetwork(gregory.db);
      setWriteTimeout(null);
    }
    expect(failure).toBeInstanceOf(WriteError);
    expect(failure?.code).toBe("timeout");
    expect(failure?.retry).toBeTypeOf("function");

    // The first attempt was queued offline and lands now; the retry writes the
    // same id and values again.
    await failure!.retry!();

    const all = await getDocs(collection(bella.db, "guests"));
    expect(all.docs.map((d) => d.id)).toEqual(["guest-retry"]);
    expect(all.docs[0].data()).toMatchObject({ name: "Wayan", createdBy: gregory.uid });
  });

  it("adds an embedded element once even when the timed-out attempt lands later", async () => {
    await seedVendor();
    // Transactions talk to the server directly, so instead of going offline the
    // timeout is made shorter than any round trip: the attempt "fails" here
    // but still commits in the background.
    setWriteTimeout(1);
    let failure: WriteError | undefined;
    try {
      await addElement("vendors", "v1", "subEntries", part("p3", "Extra hours", 5), { db: gregory.db });
    } catch (err) {
      failure = err as WriteError;
    } finally {
      setWriteTimeout(null);
    }
    expect(failure?.code).toBe("timeout");

    await expect
      .poll(async () => (await read(bella, "vendors", "v1"))?.subEntries.length, { timeout: 10_000 })
      .toBe(3);
    await failure!.retry!();
    await failure!.retry!();

    const data = await read(bella, "vendors", "v1");
    expect(data?.subEntries.map((s: { id: string }) => s.id)).toEqual(["p1", "p2", "p3"]);
  });
});

describe("embedded arrays", () => {
  it("keeps both partners' edits to different parts made at the same moment", async () => {
    await seedVendor();
    await Promise.all([
      updateElement("vendors", "v1", "subEntries", "p1", { name: "Down payment" }, { db: gregory.db }),
      updateElement("vendors", "v1", "subEntries", "p2", { budgetSpent: 45 }, { db: bella.db }),
    ]);
    const data = await read(gregory, "vendors", "v1");
    expect(data?.subEntries).toEqual([
      part("p1", "Down payment", 10, 10),
      part("p2", "Balance", 90, 45),
    ]);
    expect(data?.updatedBy).toMatch(new RegExp(`${gregory.uid}|${bella.uid}`));
  });

  it("keeps both parts when both partners add one at the same moment", async () => {
    await seedVendor([]);
    await Promise.all([
      addElement("vendors", "v1", "subEntries", part("g", "Gregory's"), { db: gregory.db }),
      addElement("vendors", "v1", "subEntries", part("b", "Bella's"), { db: bella.db }),
    ]);
    const data = await read(gregory, "vendors", "v1");
    expect(data?.subEntries.map((s: { id: string }) => s.id).sort()).toEqual(["b", "g"]);
  });

  it("keeps a partner's edit when a part is removed at the same moment", async () => {
    await seedVendor([part("p1", "A"), part("p2", "B"), part("p3", "C")]);
    await Promise.all([
      removeElement("vendors", "v1", "subEntries", "p1", { db: gregory.db }),
      updateElement("vendors", "v1", "subEntries", "p3", { name: "C, edited" }, { db: bella.db }),
    ]);
    const data = await read(gregory, "vendors", "v1");
    expect(data?.subEntries).toEqual([part("p2", "B"), part("p3", "C, edited")]);
  });

  it("applies a function patch to the latest stored element", async () => {
    await seedVendor();
    await Promise.all(
      ["a.pdf", "b.pdf", "c.pdf"].map((name, i) =>
        updateElement(
          "vendors",
          "v1",
          "subEntries",
          "p1",
          (s: Record<string, unknown> & { id: string }) => ({
            ...s,
            files: [...(s.files as object[]), { name, url: `https://x/${name}` }],
          }),
          { db: i % 2 ? bella.db : gregory.db },
        ),
      ),
    );
    const data = await read(gregory, "vendors", "v1");
    expect(data?.subEntries[0].files).toHaveLength(3);
  });

  it("moves and inserts by id and position", async () => {
    await seedVendor([part("p1", "A"), part("p2", "B"), part("p3", "C")]);
    await moveElement("vendors", "v1", "subEntries", "p3", 0, { db: gregory.db });
    await insertAt("vendors", "v1", "subEntries", part("p4", "D"), 1, { db: bella.db });
    const data = await read(gregory, "vendors", "v1");
    expect(data?.subEntries.map((s: { id: string }) => s.id)).toEqual(["p3", "p4", "p1", "p2"]);
  });

  it("says `missing` when the part was removed by the partner", async () => {
    await seedVendor();
    await removeElement("vendors", "v1", "subEntries", "p2", { db: bella.db });
    await expect(
      updateElement("vendors", "v1", "subEntries", "p2", { name: "x" }, { db: gregory.db }),
    ).rejects.toMatchObject({ code: "missing" });
    await expect(
      moveElement("vendors", "v1", "subEntries", "p2", 0, { db: gregory.db }),
    ).rejects.toMatchObject({ code: "missing" });
    expect(await removeElement("vendors", "v1", "subEntries", "p2", { db: gregory.db })).toBeNull();
  });

  it("gives old parts without an id a stable id, and stores it on the first change", async () => {
    await setDoc(doc(gregory.db, "vendors", "v1"), {
      subEntries: [{ name: "Old A", totalPrice: 1 }, { name: "Old B", totalPrice: 2 }],
    });
    const before = await read(gregory, "vendors", "v1");
    expect(withElementIds(before?.subEntries).map((s) => s.id)).toEqual(["legacy-0", "legacy-1"]);
    expect(withElementIds(before?.subEntries).map((s) => s.id)).toEqual(["legacy-0", "legacy-1"]);

    await updateElement("vendors", "v1", "subEntries", "legacy-1", { name: "Old B, edited" }, { db: bella.db });
    const after = await read(gregory, "vendors", "v1");
    expect(after?.subEntries).toEqual([
      { id: "legacy-0", name: "Old A", totalPrice: 1 },
      { id: "legacy-1", name: "Old B, edited", totalPrice: 2 },
    ]);
  });
});

describe("undo", () => {
  it("restores a removed record with the same id and every field, including the partner's last edit", async () => {
    await seedVendor();
    await update("vendors", "v1", { notes: "Bella's note" }, { db: bella.db });
    const removed = await removeWithUndo("vendors", "v1", { db: gregory.db });
    expect(await read(bella, "vendors", "v1")).toBeUndefined();

    await removed.undo();
    const data = await read(bella, "vendors", "v1");
    expect(data).toMatchObject({ name: "Dapur Lestari Catering", notes: "Bella's note", updatedBy: gregory.uid });
    expect((data?.createdAt as Timestamp).toMillis()).toBe(1_700_000_000_000);
    expect(data?.subEntries).toHaveLength(2);
  });

  it("puts a removed part back in its place without undoing the partner's edit made meanwhile", async () => {
    await seedVendor([part("p1", "A"), part("p2", "B"), part("p3", "C")]);
    const removed = await removeElementWithUndo("vendors", "v1", "subEntries", "p2", { db: gregory.db });
    expect(removed.element).toMatchObject({ id: "p2", name: "B" });

    await updateElement("vendors", "v1", "subEntries", "p3", { budgetSpent: 7 }, { db: bella.db });
    await removed.undo();

    const data = await read(gregory, "vendors", "v1");
    expect(data?.subEntries).toEqual([part("p1", "A"), part("p2", "B"), part("p3", "C", 0, 7)]);
  });

  it("undoes a field change without touching fields the partner changed", async () => {
    await setDoc(doc(gregory.db, "guests", "g1"), { name: "Maria", rsvpStatus: "pending" });
    const changed = await updateWithUndo("guests", "g1", { rsvpStatus: "yes", note: "new" }, { db: gregory.db });
    await update("guests", "g1", { name: "Maria Goretti" }, { db: bella.db });
    await changed.undo();
    const data = await read(gregory, "guests", "g1");
    expect(data).toMatchObject({ name: "Maria Goretti", rsvpStatus: "pending" });
    expect(data).not.toHaveProperty("note");
  });

  it("keeps several undos open at once", async () => {
    await Promise.all(
      ["g1", "g2", "g3"].map((id) => setDoc(doc(gregory.db, "guests", id), { name: id })),
    );
    const first = await removeWithUndo("guests", "g1", { db: gregory.db });
    const second = await removeWithUndo("guests", "g2", { db: gregory.db });
    const third = await removeWithUndo("guests", "g3", { db: bella.db });
    await first.undo();
    await third.undo();
    await second.undo();
    const all = await getDocs(collection(gregory.db, "guests"));
    expect(all.docs.map((d) => d.id).sort()).toEqual(["g1", "g2", "g3"]);
  });

  it("says `missing` when removing what the partner already removed", async () => {
    await setDoc(doc(gregory.db, "guests", "g1"), { name: "x" });
    await remove("guests", "g1", { db: bella.db });
    await expect(removeWithUndo("guests", "g1", { db: gregory.db })).rejects.toMatchObject({ code: "missing" });
  });
});
