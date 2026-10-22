"use client";

import { arrayRemove, arrayUnion, doc, writeBatch, type DocumentData } from "firebase/firestore";
import { useMemo } from "react";
import { LIST_CHANGED, MASTER_LIST_INITIAL_ROWS, renumberMasterList, useMasterListItems } from "@/lib/collections/master-list";
import type { ItemEvent, ItemPerson } from "@/lib/model/labels";
import type { ItemRecord } from "@/lib/model/items";
import { neighboursOf, positionsBetween } from "@/lib/model/row-moves";
import { logActivity } from "./activity";
import { requireDb } from "./db";
import { readOf } from "./read";
import { useSession } from "./session";
import type { Loaded } from "./settings";
import type { Undoable } from "./undo";
import { guarded, newId, stamp, transact, update, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

const COLLECTION = "masterListItems";
const META_COLLECTION = "masterListMeta";
const META_ID = "initialization";

/** How many items "Start with common items" adds (§9.2 Q12: the existing list of 44). */
export const COMMON_ITEM_COUNT = MASTER_LIST_INITIAL_ROWS.length;

/** The old screen stored three question marks for a vendor that isn't known; the new one shows the empty field's own words. */
const UNKNOWN_VENDOR = "?".repeat(3);

/**
 * The Wedding items screen's read (guide §5.22): every item in our own order,
 * live, so what the partner confirms arrives in place. Demonstration mode has none.
 */
export function useItems(): Loaded<ItemRecord[]> {
  const { connection } = useSession();
  const list = useMasterListItems();
  const items = useMemo(
    () => list.data.map((i) => (i.vendor.trim() === UNKNOWN_VENDOR ? { ...i, vendor: "" } : i)),
    [list.data],
  );
  return readOf(connection, [list], items);
}

/** The ids for a batch of new items, made once so Try again never adds them twice. */
export const newItemIds = (count: number, opts: WriteOptions = {}): string[] =>
  Array.from({ length: count }, () => newId(COLLECTION, opts));

/** Saves an item's name or vendor, or its star or tick. Names and vendors save as you go. */
export function saveItem(
  id: string,
  patch: { item: string } | { vendor: string } | { next: boolean } | { confirmed: boolean },
  opts: WriteOptions = {},
): Promise<void> {
  return update(COLLECTION, id, patch, opts);
}

/** Ticks or unticks Confirmed, and tells the partner when it is ticked ("Bella confirmed Wedding cake"). */
export async function setItemConfirmed(item: Pick<ItemRecord, "id" | "item">, confirmed: boolean, opts: WriteOptions = {}): Promise<void> {
  await saveItem(item.id, { confirmed }, opts);
  if (confirmed && item.item.trim()) void logActivity("item.confirmed", { name: item.item.trim() }, { kind: "item", id: item.id }, opts);
}

/**
 * Switches one event on or off for an item. The change is made by Firestore on
 * the stored list (not on a copy this screen holds), so the partner's tick on
 * another event stays, and saying the same thing twice changes nothing: Try
 * again is safe. It also shows at once, before the server answers.
 */
export const setItemEvent = (id: string, event: ItemEvent, on: boolean, opts: WriteOptions = {}) =>
  update(COLLECTION, id, { types: on ? arrayUnion(event) : arrayRemove(event) }, opts);

/**
 * Ticks or unticks one person an item is for (N12), the same way. Ticking
 * General leaves it for no one in particular: no people. Unticking General does
 * nothing, because nothing else is ticked.
 */
export function setItemPerson(id: string, person: ItemPerson, on: boolean, opts: WriteOptions = {}): Promise<void> {
  if (person === "General") return on ? update(COLLECTION, id, { persons: [] }, opts) : Promise.resolve();
  return update(COLLECTION, id, { persons: on ? arrayUnion(person) : arrayRemove(person) }, opts);
}

/** What a new item is made of: the events and people are copied from the row above. */
export interface NewItem {
  id: string;
  item: string;
  types: readonly ItemEvent[];
  persons: readonly ItemPerson[];
}

/** An item and where it stands in our own order, for working out where new or moved ones go. */
export type Placed = Pick<ItemRecord, "id" | "sortOrder">;

const rankOf = (ordered: readonly Placed[], id: string) => ordered.findIndex((r) => r.id === id);

/** The list with the positions a renumber gave it, in that order; an item it didn't see keeps its own. */
const renumbered = (ordered: readonly Placed[], positions: ReadonlyMap<string, number>): Placed[] =>
  ordered.map((r) => ({ id: r.id, sortOrder: positions.get(r.id) ?? r.sortOrder })).sort((a, z) => a.sortOrder - z.sortOrder);

/**
 * Adds items just below `afterId`, or at the end of the list when it is null,
 * in one transaction. `ordered` is the list in our own order; it is sorted by
 * stored position first, since the screen shows a pending move before it has
 * landed and its neighbours there aren't the stored ones (Phase 5 review S18).
 * When the gap below the row has run out the list is renumbered first
 * (inventory-notes §5 #27). The ids are the caller's, so a retry writes the
 * same items. Resolves with every item's position after the add, the new ones
 * included, so a move or add queued after it can start from them (Phase 6
 * review S8).
 */
export async function addItems(rows: readonly NewItem[], afterId: string | null, shown: readonly Placed[], opts: WriteOptions = {}, again = false): Promise<Placed[]> {
  if (rows.length < 1 || rows.length > 400) throw new Error("Add between 1 and 400 items.");
  const ordered = [...shown].sort((a, z) => a.sortOrder - z.sortOrder);
  const anchorAt = afterId === null ? ordered.length - 1 : rankOf(ordered, afterId);
  if (afterId !== null && anchorAt < 0) throw new WriteError("missing", `${COLLECTION}/${afterId} is gone`);
  const before = anchorAt >= 0 ? ordered[anchorAt].sortOrder : null;
  const after = afterId !== null && anchorAt < ordered.length - 1 ? ordered[anchorAt + 1].sortOrder : null;
  const positions = positionsBetween(before, after, rows.length);
  if (!positions) {
    if (again) throw new WriteError("failed", "There is no room left between those two items.");
    // Every item now sits a whole step from the next, so there is room.
    const positions = await renumberMasterList(requireDb(opts.db));
    return addItems(rows, afterId, renumbered(ordered, positions), opts, true);
  }

  const added = await transact(async (tx, database) => {
    const metaRef = doc(database, META_COLLECTION, META_ID);
    const marker = await tx.get(metaRef);
    const anchor = afterId === null ? null : await tx.get(doc(database, COLLECTION, afterId));
    // A retry after a timeout whose add did land: those rows stay as they are,
    // with whatever was typed into them since (Phase 7 review).
    const landed = await Promise.all(rows.map((row) => tx.get(doc(database, COLLECTION, row.id))));
    if (landed.every((snap) => snap.exists())) {
      return landed.map((snap) => ({ id: snap.id, sortOrder: snap.data()!.sortOrder as number }));
    }
    if (anchor) {
      if (!anchor.exists()) throw new WriteError("missing", `${COLLECTION}/${afterId} is gone`);
      if (anchor.data().sortOrder !== before) throw new WriteError("changed", "The list changed before these could be added.");
    }
    // At the end, the old screen's marker says where the next one goes; keep it in step.
    const markerNext = marker.exists() && typeof marker.data().nextSortOrder === "number" ? (marker.data().nextSortOrder as number) : 0;
    const start = afterId === null ? Math.max(markerNext, positions[0]) : null;
    const at = (index: number) => (start === null ? positions[index] : start + index);
    rows.forEach((row, index) => {
      if (landed[index].exists()) return;
      tx.set(doc(database, COLLECTION, row.id), {
        id: row.id,
        item: row.item,
        vendor: "",
        confirmed: false,
        types: [...row.types],
        persons: [...row.persons],
        next: false,
        sortOrder: at(index),
        ...stamp(database, true),
      });
    });
    tx.set(metaRef, { ...LIST_CHANGED, ...(start === null ? {} : { nextSortOrder: start + rows.length }), ...stamp(database) }, { merge: true });
    return rows.map((row, index) => ({ id: row.id, sortOrder: landed[index].exists() ? (landed[index].data()!.sortOrder as number) : at(index) }));
  }, opts);
  return [...ordered.filter((r) => !added.some((a) => a.id === r.id)), ...added].sort((a, z) => a.sortOrder - z.sortOrder);
}

/**
 * Moves one item to where `ids` (the whole list in its new order) puts it,
 * changing only that item's position. Refuses when a neighbour has been moved
 * meanwhile, so the order the partner made is never undone by a stale drop.
 * Resolves with every item's position after the move, so the next move can
 * start from it before the list is read again (Phase 4 review S21).
 */
export async function moveItem(ordered: readonly Placed[], ids: readonly string[], movedId: string, opts: WriteOptions = {}, again = false): Promise<Placed[]> {
  const { above, below } = neighboursOf(ids, movedId);
  const sortOrderOf = (list: readonly Placed[], id: string | null) => (id === null ? null : (list.find((r) => r.id === id)?.sortOrder ?? null));
  const [high, low] = [sortOrderOf(ordered, above), sortOrderOf(ordered, below)];
  const positions = positionsBetween(high, low, 1);
  if (!positions) {
    if (again) throw new WriteError("failed", "There is no room left between those two items.");
    const positions = await renumberMasterList(requireDb(opts.db));
    return moveItem(renumbered(ordered, positions), ids, movedId, opts, true);
  }

  await transact(async (tx, database) => {
    const read = async (id: string | null, expected: number | null) => {
      if (id === null) return;
      const snap = await tx.get(doc(database, COLLECTION, id));
      if (!snap.exists()) throw new WriteError("missing", `${COLLECTION}/${id} is gone`);
      // After a renumber the neighbours hold their ranks, which the caller passed in.
      if (snap.data().sortOrder !== expected) throw new WriteError("changed", "The list changed before this could move.");
    };
    const movedRef = doc(database, COLLECTION, movedId);
    const moved = await tx.get(movedRef);
    if (!moved.exists()) throw new WriteError("missing", `${COLLECTION}/${movedId} is gone`);
    await read(above, high);
    await read(below, low);
    tx.update(movedRef, { sortOrder: positions[0], ...stamp(database) });
  }, opts);
  return ordered.map((r) => (r.id === movedId ? { id: r.id, sortOrder: positions[0] } : r)).sort((a, z) => a.sortOrder - z.sortOrder);
}

/**
 * Removes an item, with an undo that puts it back exactly, at the same place.
 * Both tell the list's marker, so a renumber running meanwhile lists again.
 */
export async function removeItem(id: string, opts: WriteOptions = {}): Promise<Undoable> {
  const database = requireDb(opts.db);
  const ref = doc(database, COLLECTION, id);
  const metaRef = doc(database, META_COLLECTION, META_ID);
  // Read and delete in one transaction, so the copy kept for undo includes any change the partner made up to the delete.
  const data = await transact(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new WriteError("missing", `${COLLECTION}/${id} is gone`);
    tx.delete(ref);
    tx.set(metaRef, { ...LIST_CHANGED, ...stamp(database) }, { merge: true });
    return snap.data();
  }, opts);
  return {
    undo: () =>
      guarded(() => {
        const batch = writeBatch(database);
        batch.set(ref, { ...data, ...stamp(database) });
        batch.set(metaRef, { ...LIST_CHANGED, ...stamp(database) }, { merge: true });
        return batch.commit();
      }),
  };
}

/** Takes added items out again (undo of an add). Items already gone are left. */
export async function removeItems(ids: readonly string[], opts: WriteOptions = {}): Promise<void> {
  const database = requireDb(opts.db);
  const batch = writeBatch(database);
  ids.forEach((id) => batch.delete(doc(database, COLLECTION, id)));
  batch.set(doc(database, META_COLLECTION, META_ID), { ...LIST_CHANGED, ...stamp(database) }, { merge: true });
  await guarded(() => batch.commit());
}

const fromSeed = (row: (typeof MASTER_LIST_INITIAL_ROWS)[number], sortOrder: number): DocumentData => ({
  id: row.id,
  item: row.item,
  vendor: row.vendor.trim() === UNKNOWN_VENDOR ? "" : row.vendor,
  confirmed: row.confirmed,
  types: [],
  persons: [],
  next: false,
  sortOrder,
});

/**
 * Starts the tracker with the common items (T10, §9.2 Q12): the existing 44.
 * `onlyFirstUse` is the guard the old screen keeps: a tracker that has been
 * started before (and then emptied on purpose) is never filled again by itself,
 * only by the button. Resolves with the ids it added, or null when it didn't.
 * The seed ids are stable, so pressing again never makes copies.
 */
export async function startWithCommonItems(onlyFirstUse: boolean, opts: WriteOptions = {}): Promise<string[] | null> {
  return transact(async (tx, database) => {
    const metaRef = doc(database, META_COLLECTION, META_ID);
    const marker = await tx.get(metaRef);
    if (onlyFirstUse && marker.exists()) return null;
    const existing = await Promise.all(MASTER_LIST_INITIAL_ROWS.map((row) => tx.get(doc(database, COLLECTION, row.id))));
    const added: string[] = [];
    MASTER_LIST_INITIAL_ROWS.forEach((row, index) => {
      if (existing[index].exists()) return;
      tx.set(doc(database, COLLECTION, row.id), { ...fromSeed(row, index), ...stamp(database, true) });
      added.push(row.id);
    });
    const markerNext = marker.exists() && typeof marker.data().nextSortOrder === "number" ? (marker.data().nextSortOrder as number) : 0;
    tx.set(metaRef, { ...LIST_CHANGED, initialized: true, nextSortOrder: Math.max(markerNext, COMMON_ITEM_COUNT), ...stamp(database) }, { merge: true });
    return added;
  }, opts);
}
