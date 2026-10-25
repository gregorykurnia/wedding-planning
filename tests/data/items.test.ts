import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, writeBatch } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMMON_ITEM_COUNT,
  addItems,
  moveItem,
  newItemIds,
  removeItem,
  removeItems,
  saveItem,
  setItemConfirmed,
  setItemEvent,
  setItemPerson,
  startWithCommonItems,
} from "@/lib/data/items";
import { renumberMasterList } from "@/lib/collections/master-list";
import { WriteError } from "@/lib/data/write-error";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

// Task 4.23: the Wedding items screen's writes, against the emulators (guide §5.22).

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

const seed = (id: string, sortOrder: number, over: Record<string, unknown> = {}) =>
  setDoc(doc(gregory.db, "masterListItems", id), {
    id,
    item: id,
    vendor: "",
    confirmed: false,
    types: [],
    persons: [],
    next: false,
    sortOrder,
    ...over,
  });

const read = async (id: string) => (await getDoc(doc(gregory.db, "masterListItems", id))).data();

/** The ids in our own order, as the screen reads them. */
const order = async () => {
  const snap = await getDocs(query(collection(gregory.db, "masterListItems"), orderBy("sortOrder", "asc")));
  return snap.docs.map((d) => d.id);
};

const placed = async () => {
  const snap = await getDocs(query(collection(gregory.db, "masterListItems"), orderBy("sortOrder", "asc")));
  return snap.docs.map((d) => ({ id: d.id, sortOrder: d.data().sortOrder as number }));
};

describe("saving an item", () => {
  it("saves a name, a vendor, the star and the tick, stamped with who and when", async () => {
    await seed("cake", 0);
    await saveItem("cake", { item: "Wedding cake" }, g());
    await saveItem("cake", { vendor: "Manis" }, g());
    await saveItem("cake", { next: true }, g());
    await saveItem("cake", { confirmed: true }, g());
    await saveItem("cake", { category: "Wedding Cake" }, g());
    const cake = await read("cake");
    expect(cake).toMatchObject({ item: "Wedding cake", vendor: "Manis", category: "Wedding Cake", next: true, confirmed: true, updatedBy: gregory.uid });
  });

  it("tells the partner when an item is confirmed, not when it is unconfirmed", async () => {
    await seed("cake", 0);
    await setItemConfirmed({ id: "cake", item: "Wedding cake" }, true, g());
    await setItemConfirmed({ id: "cake", item: "Wedding cake" }, false, g());
    // The entry is written after the change, without waiting for it.
    await vi.waitFor(async () => expect((await getDocs(collection(gregory.db, "activity"))).size).toBe(1));
    const news = (await getDocs(collection(gregory.db, "activity"))).docs.map((d) => d.data());
    expect(news[0]).toMatchObject({ kind: "item.confirmed", params: { name: "Wedding cake" }, target: { kind: "item", id: "cake" } });
  });

  it("switches events on and off from the latest stored copy, so the partner's tick on another event stays", async () => {
    await seed("cake", 0, { types: ["Reception"] });
    await setItemEvent("cake", "Sangjit", true, b());
    await setItemEvent("cake", "Matrimony", true, g());
    expect((await read("cake"))?.types).toEqual(["Reception", "Sangjit", "Matrimony"]);
    await setItemEvent("cake", "Reception", false, g());
    expect((await read("cake"))?.types).toEqual(["Sangjit", "Matrimony"]);
  });

  it("says the same thing twice without changing anything the second time, so Try again is safe", async () => {
    await seed("cake", 0, { types: ["Reception"], persons: ["Bride"] });
    await setItemEvent("cake", "Reception", true, g());
    await setItemPerson("cake", "Bride", true, g());
    expect(await read("cake")).toMatchObject({ types: ["Reception"], persons: ["Bride"] });
  });

  it("keeps several people on one item, and ticking General leaves it for no one (N12)", async () => {
    await seed("makeup", 0, { persons: ["Bride Mom", "Groom Mom"] });
    await setItemPerson("makeup", "Groom Dad", true, g());
    expect((await read("makeup"))?.persons).toEqual(["Bride Mom", "Groom Mom", "Groom Dad"]);
    await setItemPerson("makeup", "Bride Mom", false, g());
    expect((await read("makeup"))?.persons).toEqual(["Groom Mom", "Groom Dad"]);
    await setItemPerson("makeup", "General", true, g());
    expect((await read("makeup"))?.persons).toEqual([]);
  });

  it("leaves the old screen's General in the list when someone is ticked; the new screen ignores it", async () => {
    await seed("pillow", 0, { persons: ["General"] });
    await setItemPerson("pillow", "Bride", true, g());
    expect((await read("pillow"))?.persons).toEqual(["General", "Bride"]);
    await setItemPerson("pillow", "General", true, g());
    expect((await read("pillow"))?.persons).toEqual([]);
  });

  it("does nothing when General is unticked, since nothing else is ticked", async () => {
    await seed("pillow", 0, { persons: [] });
    await setItemPerson("pillow", "General", false, g());
    expect((await read("pillow"))?.persons).toEqual([]);
  });

  it("says the item is gone when the partner removed it", async () => {
    await expect(setItemEvent("nope", "Sangjit", true, g())).rejects.toMatchObject({ code: "missing" });
  });
});

describe("adding items", () => {
  it("adds below a row, in the gap, copying the events and people it is given", async () => {
    await seed("a", 0);
    await seed("b", 1);
    const [one, two] = newItemIds(2, g());
    await addItems(
      [
        { id: one, item: "Bride's mother's makeup", category: "Make Up Artist", types: ["Reception"], persons: ["Bride Mom"] },
        { id: two, item: "Groom's father's suit", types: ["Reception"], persons: ["Bride Mom"] },
      ],
      "a",
      await placed(),
      g(),
    );
    expect(await order()).toEqual(["a", one, two, "b"]);
    expect(await read(one)).toMatchObject({ item: "Bride's mother's makeup", category: "Make Up Artist", types: ["Reception"], persons: ["Bride Mom"], confirmed: false, next: false, createdBy: gregory.uid });
    expect(await read(two)).toMatchObject({ category: "Other" });
  });

  // Phase 5 review S18: the screen shows a move before it lands, so its order isn't the stored one.
  it("adds below a row by stored position while a move is still showing, so no two rows share a place", async () => {
    await seed("a", 0);
    await seed("b", 1);
    await seed("c", 2);
    // c is shown moved up below a; its position is still 2.
    const shown = [{ id: "a", sortOrder: 0 }, { id: "c", sortOrder: 2 }, { id: "b", sortOrder: 1 }];
    const [id] = newItemIds(1, g());
    await addItems([{ id, item: "Veil", types: [], persons: [] }], "a", shown, g());
    const positions = (await placed()).map((r) => r.sortOrder);
    expect(new Set(positions).size).toBe(4);
    expect(await order()).toEqual(["a", id, "b", "c"]);
  });

  it("adds at the end, after the old screen's next position", async () => {
    await seed("a", 0);
    await setDoc(doc(gregory.db, "masterListMeta", "initialization"), { initialized: true, nextSortOrder: 10 });
    const [id] = newItemIds(1, g());
    await addItems([{ id, item: "Last", types: [], persons: [] }], null, await placed(), g());
    expect((await read(id))?.sortOrder).toBe(10);
    expect((await getDoc(doc(gregory.db, "masterListMeta", "initialization"))).data()?.nextSortOrder).toBe(11);
    expect(await order()).toEqual(["a", id]);
  });

  it("adds to an empty list", async () => {
    const [id] = newItemIds(1, g());
    await addItems([{ id, item: "First", types: [], persons: [] }], null, [], g());
    expect(await order()).toEqual([id]);
  });

  it("writes the same items again on Try again, never copies", async () => {
    await seed("a", 0);
    const [id] = newItemIds(1, g());
    const row = { id, item: "Pillow", types: [], persons: [] };
    await addItems([row], "a", await placed(), g());
    await addItems([row], "a", [{ id: "a", sortOrder: 0 }], g());
    expect(await order()).toEqual(["a", id]);
  });

  // Phase 7 review: the add timed out but landed, the row was named, then Try again.
  it("keeps what was typed into a row whose add landed before its Try again", async () => {
    await seed("a", 0);
    const [id] = newItemIds(1, g());
    const row = { id, item: "", types: [], persons: [] };
    await addItems([row], "a", await placed(), g());
    await setDoc(doc(gregory.db, "masterListItems", id), { item: "Veil", confirmed: true }, { merge: true });
    await addItems([row], "a", [{ id: "a", sortOrder: 0 }], g());
    expect((await getDoc(doc(gregory.db, "masterListItems", id))).data()).toMatchObject({ item: "Veil", confirmed: true });
    expect(await order()).toEqual(["a", id]);
  });

  it("renumbers the list first when the gap below the row has run out", async () => {
    await seed("a", 1);
    await seed("b", 1 + 1e-9);
    await seed("c", 5);
    const [id] = newItemIds(1, g());
    await addItems([{ id, item: "Tight", types: [], persons: [] }], "a", await placed(), g());
    expect(await order()).toEqual(["a", id, "b", "c"]);
    const sortOrders = (await placed()).map((r) => r.sortOrder);
    expect(sortOrders).toEqual([...sortOrders].sort((x, y) => x - y));
    expect(new Set(sortOrders).size).toBe(4);
  });

  it("refuses when the row it was to go below has gone, or has moved", async () => {
    await seed("a", 0);
    await seed("b", 1);
    const [id] = newItemIds(1, g());
    const row = { id, item: "X", types: [], persons: [] };
    const stale = await placed();
    await setDoc(doc(gregory.db, "masterListItems", "a"), { sortOrder: 7 }, { merge: true });
    await expect(addItems([row], "a", stale, g())).rejects.toMatchObject({ code: "changed" });
    await expect(addItems([row], "gone", stale, g())).rejects.toBeInstanceOf(WriteError);
    expect(await order()).toEqual(["b", "a"]);
  });

  it("takes added items out again, leaving any already gone", async () => {
    await seed("a", 0);
    const ids = newItemIds(2, g());
    await addItems(ids.map((id) => ({ id, item: id, types: [], persons: [] })), "a", await placed(), g());
    await removeItems([...ids, "never-there"], g());
    expect(await order()).toEqual(["a"]);
  });
});

describe("moving an item", () => {
  const abc = async () => {
    await seed("a", 0);
    await seed("b", 1);
    await seed("c", 2);
    await seed("d", 3);
  };

  it("changes only the moved item's position", async () => {
    await abc();
    await moveItem(await placed(), ["a", "c", "b", "d"], "c", g());
    expect(await order()).toEqual(["a", "c", "b", "d"]);
    expect(await read("a")).toMatchObject({ sortOrder: 0 });
    expect(await read("b")).toMatchObject({ sortOrder: 1 });
    expect(await read("c")).toMatchObject({ sortOrder: 0.5 });
  });

  it("moves to the very top and the very end", async () => {
    await abc();
    await moveItem(await placed(), ["d", "a", "b", "c"], "d", g());
    expect(await order()).toEqual(["d", "a", "b", "c"]);
    await moveItem(await placed(), ["a", "b", "c", "d"], "d", g());
    expect(await order()).toEqual(["a", "b", "c", "d"]);
  });

  it("refuses a drop that would undo a move the partner made meanwhile", async () => {
    await abc();
    const stale = await placed();
    await moveItem(await placed(), ["b", "a", "c", "d"], "b", b());
    await expect(moveItem(stale, ["a", "d", "b", "c"], "d", g())).rejects.toMatchObject({ code: "changed" });
    expect(await order()).toEqual(["b", "a", "c", "d"]);
  });

  it("renumbers first when the neighbours have no room between them", async () => {
    await seed("a", 1);
    await seed("b", 1 + 1e-9);
    await seed("c", 3);
    await moveItem(await placed(), ["a", "c", "b"], "c", g());
    expect(await order()).toEqual(["a", "c", "b"]);
  });

  it("says the item is gone when the partner removed it", async () => {
    await abc();
    const stale = await placed();
    await removeItem("c", b());
    await expect(moveItem(stale, ["a", "c", "b", "d"], "c", g())).rejects.toMatchObject({ code: "missing" });
  });
});

describe("ordering under load (Phase 1 review S5, Phase 4 review S21)", () => {
  const version = async () => (await getDoc(doc(gregory.db, "masterListMeta", "initialization"))).data()?.version ?? 0;

  it("each move starts from where the one before left things, without reading the list again", async () => {
    await seed("a", 0);
    await seed("b", 1);
    await seed("c", 2);
    await seed("d", 3);
    let placedNow = await placed();
    placedNow = await moveItem(placedNow, ["b", "a", "c", "d"], "a", g());
    placedNow = await moveItem(placedNow, ["b", "c", "a", "d"], "a", g());
    await moveItem(placedNow, ["b", "c", "d", "a"], "a", g());
    expect(await order()).toEqual(["b", "c", "d", "a"]);
  });

  it("bumps the list's version on every add and removal, and on undoing either", async () => {
    await seed("a", 0);
    const v0 = await version();
    const [id] = newItemIds(1, g());
    await addItems([{ id, item: "Cake", types: [], persons: [] }], null, await placed(), g());
    expect(await version()).toBe(v0 + 1);
    const { undo } = await removeItem("a", g());
    expect(await version()).toBe(v0 + 2);
    await undo();
    expect(await version()).toBe(v0 + 3);
    await removeItems([id], g());
    expect(await version()).toBe(v0 + 4);
  });

  it("a renumber lists again when the partner adds a row after it listed, so no two rows share a place", async () => {
    await seed("a", 0);
    await seed("b", 0.5);
    await seed("c", 1);
    await setDoc(doc(gregory.db, "masterListMeta", "initialization"), { initialized: true, nextSortOrder: 2 });
    let added = false;
    await renumberMasterList(gregory.db, async () => {
      if (added) return;
      added = true;
      await addItems([{ id: "late", item: "Late", types: [], persons: [] }], null, await placed(), b());
    });
    const snap = await getDocs(query(collection(gregory.db, "masterListItems"), orderBy("sortOrder", "asc")));
    const positions = snap.docs.map((d) => d.data().sortOrder as number);
    expect(snap.docs.map((d) => d.id)).toEqual(["a", "b", "c", "late"]);
    expect(positions).toEqual([0, 1, 2, 3]);
  });

  it("above 490 items, the first move after a renumber goes through", async () => {
    const total = 495;
    for (let from = 0; from < total; from += 400) {
      const batch = writeBatch(gregory.db);
      for (let i = from; i < Math.min(total, from + 400); i++) {
        batch.set(doc(gregory.db, "masterListItems", `i${String(i).padStart(3, "0")}`), { id: `i${i}`, item: "", vendor: "", confirmed: false, types: [], persons: [], next: false, sortOrder: i });
      }
      await batch.commit();
    }
    // No room between the first two.
    await setDoc(doc(gregory.db, "masterListItems", "i001"), { sortOrder: 1e-9 }, { merge: true });
    const before = await placed();
    const ids = before.map((r) => r.id);
    const next = [ids[0], ids[total - 1], ...ids.slice(1, total - 1)];
    await moveItem(before, next, ids[total - 1], g());
    expect(await order()).toEqual(next);
  });
});

describe("ordering, the rest (Phase 5 review S21)", () => {
  it("above 490 items, a renumber lists again when a row is added while its batches run, so no two rows share a place", async () => {
    const total = 495;
    for (let from = 0; from < total; from += 400) {
      const batch = writeBatch(gregory.db);
      for (let i = from; i < Math.min(total, from + 400); i++) {
        batch.set(doc(gregory.db, "masterListItems", `i${String(i).padStart(3, "0")}`), { id: `i${i}`, item: "", vendor: "", confirmed: false, types: [], persons: [], next: false, sortOrder: i });
      }
      await batch.commit();
    }
    let added = false;
    await renumberMasterList(gregory.db, async () => {
      if (added) return;
      added = true;
      await addItems([{ id: "late", item: "Late", types: [], persons: [] }], null, await placed(), b());
    });
    const positions = (await placed()).map((r) => r.sortOrder);
    expect(positions).toHaveLength(total + 1);
    expect(new Set(positions).size).toBe(total + 1);
    const next = (await getDoc(doc(gregory.db, "masterListMeta", "initialization"))).data()?.nextSortOrder;
    expect(next).toBeGreaterThan(Math.max(...positions));
  });
});

describe("write races (Phase 6 review S8, S11)", () => {
  // S8: rows X, A, B; Alt+↓ on X, then "add below A" before the next read. The screen runs the add
  // after the move, from the positions the move left.
  it("an add queued after a move goes in the gap the move left, and the next move starts from the add", async () => {
    await seed("x", 0);
    await seed("a", 1);
    await seed("b", 2);
    const afterMove = await moveItem(await placed(), ["a", "x", "b"], "x", g());
    const [id] = newItemIds(1, g());
    const afterAdd = await addItems([{ id, item: "", types: [], persons: [] }], "a", afterMove, g());
    expect(await order()).toEqual(["a", id, "x", "b"]);
    expect(new Set((await placed()).map((r) => r.sortOrder)).size).toBe(4);
    expect(afterAdd).toEqual(await placed());
    await moveItem(afterAdd, ["a", "x", id, "b"], id, g());
    expect(await order()).toEqual(["a", "x", id, "b"]);
  });

  // Phase 7 review S6: rows X, A, B; "add below A", then Alt+↓ on X before the list shows the new row.
  it("a move queued after an add takes the gap below the added row, not the same one", async () => {
    await seed("x", 0);
    await seed("a", 1);
    await seed("b", 2);
    const [id] = newItemIds(1, g());
    const afterAdd = await addItems([{ id, item: "", types: [], persons: [] }], "a", await placed(), g());
    // The screen's order still lacks the new row.
    await moveItem(afterAdd, ["a", "x", "b"], "x", g());
    expect(new Set((await placed()).map((r) => r.sortOrder)).size).toBe(4);
    expect(await order()).toEqual(["a", "x", id, "b"]);
  });

  // S11: a row removed while the batches run made the second batch fail after the first had moved its rows.
  it("above 490 items, a row removed while a renumber runs leaves the order as it was, and it lists again", async () => {
    const total = 495;
    const ids = Array.from({ length: total }, (_, i) => `i${String(i).padStart(3, "0")}`);
    for (let from = 0; from < total; from += 400) {
      const batch = writeBatch(gregory.db);
      for (let i = from; i < Math.min(total, from + 400); i++) {
        batch.set(doc(gregory.db, "masterListItems", ids[i]), { id: ids[i], item: "", vendor: "", confirmed: false, types: [], persons: [], next: false, sortOrder: i });
      }
      await batch.commit();
    }
    let removed = false;
    await renumberMasterList(gregory.db, async () => {
      if (removed) return;
      removed = true;
      await removeItem("i492", b());
    });
    const left = ids.filter((id) => id !== "i492");
    expect(await order()).toEqual(left);
    const positions = (await placed()).map((r) => r.sortOrder);
    expect(new Set(positions).size).toBe(total - 1);
  });
});

describe("removing an item", () => {
  it("puts it back exactly, at the same place, on undo", async () => {
    await seed("a", 0);
    await seed("b", 1, { item: "Wedding cake", types: ["Reception"], persons: ["Bride", "Groom"], next: true, vendor: "Manis" });
    await seed("c", 2);
    const { undo } = await removeItem("b", g());
    expect(await order()).toEqual(["a", "c"]);
    await undo();
    expect(await order()).toEqual(["a", "b", "c"]);
    expect(await read("b")).toMatchObject({ item: "Wedding cake", types: ["Reception"], persons: ["Bride", "Groom"], next: true, vendor: "Manis", sortOrder: 1 });
  });

  it("says the item is gone when the partner removed it first", async () => {
    await seed("a", 0);
    await removeItem("a", b());
    await expect(removeItem("a", g())).rejects.toMatchObject({ code: "missing" });
  });
});

describe("starting with common items", () => {
  it("fills in a tracker that has never been started, once", async () => {
    const added = await startWithCommonItems(true, g());
    expect(added).toHaveLength(COMMON_ITEM_COUNT);
    expect(await order()).toHaveLength(COMMON_ITEM_COUNT);
    expect(await startWithCommonItems(true, g())).toBeNull();
    expect((await getDoc(doc(gregory.db, "masterListMeta", "initialization"))).data()).toMatchObject({ initialized: true, nextSortOrder: COMMON_ITEM_COUNT });
  });

  it("writes an unknown vendor as an empty one and keeps the confirmed ones", async () => {
    await startWithCommonItems(true, g());
    expect(await read("master-04-hotel-h-1-venue")).toMatchObject({ vendor: "", confirmed: false });
    expect(await read("master-01-reception-venue")).toMatchObject({ vendor: "The Langham Jakarta", confirmed: true });
  });

  it("files each common item under its category", async () => {
    await startWithCommonItems(true, g());
    expect(await read("master-01-reception-venue")).toMatchObject({ category: "Venue" });
    expect(await read("master-19-make-up-artist-groom-and-bride-moms")).toMatchObject({ category: "Make Up Artist" });
    expect(await read("master-44-bride-nails")).toMatchObject({ category: "Shoes and Accessories" });
  });

  it("never fills in a tracker that was emptied on purpose by itself, only by the button", async () => {
    await startWithCommonItems(true, g());
    await removeItems(await order(), g());
    expect(await order()).toEqual([]);
    expect(await startWithCommonItems(true, g())).toBeNull();
    const again = await startWithCommonItems(false, g());
    expect(again).toHaveLength(COMMON_ITEM_COUNT);
    expect(await order()).toHaveLength(COMMON_ITEM_COUNT);
  });

  it("leaves common items that are already there untouched", async () => {
    await startWithCommonItems(true, g());
    await saveItem("master-13-wedding-cake", { vendor: "Manis Cake Studio" }, g());
    const added = await startWithCommonItems(false, g());
    expect(added).toEqual([]);
    expect(await read("master-13-wedding-cake")).toMatchObject({ vendor: "Manis Cake Studio" });
  });
});

describe("renumber races above 490 items (Phase 7 review S8)", () => {
  const total = 495;
  const ids = Array.from({ length: total }, (_, i) => `i${String(i).padStart(3, "0")}`);
  const seedMany = async () => {
    for (let from = 0; from < total; from += 400) {
      const batch = writeBatch(gregory.db);
      for (let i = from; i < Math.min(total, from + 400); i++) {
        batch.set(doc(gregory.db, "masterListItems", ids[i]), { id: ids[i], item: "", vendor: "", confirmed: false, types: [], persons: [], next: false, sortOrder: i });
      }
      await batch.commit();
    }
  };

  it("a move on a row not yet renumbered stays moved", async () => {
    await seedMany();
    let moved = false;
    await renumberMasterList(gregory.db, undefined, async () => {
      if (moved) return;
      moved = true;
      const next = [ids[0], ids[10], ...ids.slice(1, 10), ...ids.slice(11)];
      await moveItem(await placed(), next, ids[10], b());
    });
    const after = await order();
    expect(after.slice(0, 3)).toEqual([ids[0], ids[10], ids[1]]);
    expect(new Set((await placed()).map((r) => r.sortOrder)).size).toBe(total);
  });

  // Phase 8 review S5: moves between the part already renumbered (the last rows) and the part not yet.
  it("a row moved from the renumbered part into the part not yet renumbered stays moved", async () => {
    await seedMany();
    let moved = false;
    await renumberMasterList(gregory.db, undefined, async () => {
      if (moved) return;
      moved = true;
      const next = [ids[0], ids[492], ...ids.slice(1, 492), ...ids.slice(493)];
      await moveItem(await placed(), next, ids[492], b());
    });
    const after = await order();
    expect(after.slice(0, 3)).toEqual([ids[0], ids[492], ids[1]]);
    expect(after.at(-1)).toBe(ids[494]);
    expect(new Set((await placed()).map((r) => r.sortOrder)).size).toBe(total);
  });

  it("a row moved from the part not yet renumbered into the renumbered part stays moved", async () => {
    await seedMany();
    let moved = false;
    await renumberMasterList(gregory.db, undefined, async () => {
      if (moved) return;
      moved = true;
      const next = [...ids.slice(0, 5), ...ids.slice(6, 493), ids[5], ...ids.slice(493)];
      await moveItem(await placed(), next, ids[5], b());
    });
    const after = await order();
    expect(after.slice(-4)).toEqual([ids[492], ids[5], ids[493], ids[494]]);
    expect(after.slice(4, 6)).toEqual([ids[4], ids[6]]);
    expect(new Set((await placed()).map((r) => r.sortOrder)).size).toBe(total);
  });

  it("a row added below one not yet renumbered stays below it", async () => {
    await seedMany();
    let added = false;
    await renumberMasterList(gregory.db, undefined, async () => {
      if (added) return;
      added = true;
      await addItems([{ id: "late", item: "Late", types: [], persons: [] }], ids[10], await placed(), b());
    });
    const after = await order();
    expect(after.slice(10, 13)).toEqual([ids[10], "late", ids[11]]);
    expect(new Set((await placed()).map((r) => r.sortOrder)).size).toBe(total + 1);
  });

  it("a row added at the end from the list as it was before lands after every row", async () => {
    await seedMany();
    const before = await placed();
    let added = false;
    await renumberMasterList(gregory.db, undefined, async () => {
      if (added) return;
      added = true;
      await addItems([{ id: "late", item: "Late", types: [], persons: [] }], null, before, b());
    });
    expect(await order()).toEqual([...ids, "late"]);
  });

  it("a move bumps the list's version", async () => {
    await seed("a", 0);
    await seed("b", 1);
    const version = async () => (await getDoc(doc(gregory.db, "masterListMeta", "initialization"))).data()?.version ?? 0;
    const v0 = await version();
    await moveItem(await placed(), ["b", "a"], "a", g());
    expect(await version()).toBe(v0 + 1);
  });
});
