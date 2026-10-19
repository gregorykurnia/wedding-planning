import { deleteField, doc, FieldValue, setDoc, type DocumentData, type Firestore } from "firebase/firestore";
import { insertAt, removeElement, withElementIds, type Element } from "./array-ops";
import { requireDb, uidOf } from "./db";
import { guarded, stamp, transact, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

/**
 * Undo for the guide §6.2 toast. Each call returns its own `undo()`, so
 * several can be open at once (inventory-notes §5 #32). Undo puts back the
 * same id and every field, including `createdAt` and order fields, so the
 * record returns to the same place in every list.
 */
export interface Undoable {
  undo: () => Promise<void>;
}

/** Deletes a document and returns an undo that restores it exactly. */
export async function removeWithUndo(
  collectionName: string,
  id: string,
  opts: WriteOptions & {
    /** Throws to refuse the delete, given the record as it is now. */
    guard?: (data: DocumentData) => void;
  } = {},
): Promise<Undoable & { data: DocumentData }> {
  const database = requireDb(opts.db);
  const ref = doc(database, collectionName, id);
  // Read and delete in one transaction, so the copy kept for undo includes any
  // change the partner made right up to the delete.
  const data = await transact(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new WriteError("missing", `${collectionName}/${id} is gone`);
    opts.guard?.(snap.data());
    tx.delete(ref);
    return snap.data();
    // A try after a timeout takes the earlier try's copy if that one landed late (`guarded`).
  }, { db: database, key: `remove:${collectionName}/${id}` });
  return {
    data,
    undo: () => guarded(() => setDoc(ref, { ...data, ...stamp(database) })),
  };
}

/**
 * Whether two stored values are the same: maps compare by keys whatever their
 * order (a key holding `undefined` counts as missing), arrays by position,
 * Timestamps and other Firestore values by their own `isEqual`.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  }
  const equal = (a as { isEqual?: unknown }).isEqual;
  if (typeof equal === "function") return Object.getPrototypeOf(a) === Object.getPrototypeOf(b) && Boolean(equal.call(a, b));
  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) return false;
  const keys = (o: object) => Object.keys(o).filter((k) => (o as Record<string, unknown>)[k] !== undefined);
  const ka = keys(a);
  return ka.length === keys(b).length && ka.every((k) => k in b && sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Throws `changed` unless every field still holds what `written` put there.
 * A `deleteField()` must still be missing; other sentinels (server times)
 * can't be compared and are let through.
 */
function stillAsWritten(data: DocumentData, written: Record<string, unknown>, what: string, database: Firestore) {
  for (const [key, value] of Object.entries(written)) {
    if (value instanceof FieldValue) {
      if (value.isEqual(deleteField()) && data[key] !== undefined) throw changedSince(what, data, database);
      continue;
    }
    if (!sameValue(data[key], value)) throw changedSince(what, data, database);
  }
}

/**
 * The `changed` refusal, saying who changed the record last (its `updatedBy`):
 * you, on this device or another, or the partner.
 */
export function changedSince(what: string, data: DocumentData, database: Firestore): WriteError {
  const failure = new WriteError("changed", `${what} changed after this, so undo would erase that change`);
  const uid = uidOf(database);
  failure.by = uid !== null && data.updatedBy === uid ? "you" : "partner";
  return failure;
}

/**
 * Works out a change from the record as it is now, writes it, and returns an
 * undo that puts the earlier values of those fields back (fields that didn't
 * exist are removed again). Only the fields in the change are touched by
 * either step, so the partner's other edits stay. Undo refuses with
 * `changed`, writing nothing, when any of those fields no longer holds what
 * this change wrote: putting the old value back would silently erase the
 * later edit (a payment recorded on a part after a split, a file moved again
 * by the partner). `change` returning null writes nothing, and its undo does
 * nothing.
 */
export async function patchWithUndo<R = undefined>(
  collectionName: string,
  id: string,
  change: (data: DocumentData) => { patch: Record<string, unknown>; result?: R } | null,
  opts: WriteOptions = {},
): Promise<Undoable & { before: Record<string, unknown>; result: R | undefined; changed: boolean }> {
  const database = requireDb(opts.db);
  const ref = doc(database, collectionName, id);
  const { before, written, result, changed } = await transact(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new WriteError("missing", `${collectionName}/${id} is gone`);
    const data = snap.data();
    const out = change(data);
    if (!out) return { before: {}, written: {}, result: undefined, changed: false };
    const previous: Record<string, unknown> = {};
    for (const key of Object.keys(out.patch)) {
      previous[key] = key in data ? data[key] : deleteField();
    }
    tx.update(ref, { ...out.patch, ...stamp(database) });
    return { before: previous, written: out.patch, result: out.result, changed: true };
  }, { db: database });
  // A second tap on Undo after one that worked does nothing.
  let undone = false;
  return {
    before,
    result,
    changed,
    undo: async () => {
      if (!changed || undone) return;
      await transact(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new WriteError("missing", `${collectionName}/${id} is gone`);
        stillAsWritten(snap.data(), written, `${collectionName}/${id}`, database);
        tx.update(ref, { ...before, ...stamp(database) });
      }, { db: database });
      undone = true;
    },
  };
}

/**
 * The undo for adding one element to an embedded array: takes that element
 * out again by id, so edits to the other elements in the meantime stay. If the
 * element itself was changed since it was added (a price typed, a payment
 * recorded on it), undo refuses with `changed` rather than drop that. Already
 * gone: nothing to do.
 */
export function removeAddedElement(
  collectionName: string,
  docId: string,
  field: string,
  added: Element,
  opts: WriteOptions = {},
): Promise<void> {
  return transact(async (tx, database) => {
    const ref = doc(database, collectionName, docId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new WriteError("missing", `${collectionName}/${docId} is gone`);
    const items = withElementIds<Element>(snap.data()[field]);
    const now = items.find((item) => item.id === added.id);
    // Already gone: write nothing, so the record isn't stamped as edited.
    if (!now) return;
    if (!sameValue(now, added)) throw changedSince(`${field} ${added.id}`, snap.data(), database);
    tx.update(ref, { [field]: items.filter((item) => item.id !== added.id), ...stamp(database) });
  }, opts);
}

/** Changes top-level fields, with an undo that puts the earlier values back. */
export function updateWithUndo(
  collectionName: string,
  id: string,
  patch: Record<string, unknown>,
  opts: WriteOptions = {},
): Promise<Undoable & { before: Record<string, unknown> }> {
  return patchWithUndo(collectionName, id, () => ({ patch }), opts);
}

/**
 * Removes one element of an embedded array. Undo inserts it back at the same
 * index of the array as it is then, so the partner's edits to other elements
 * in the meantime survive.
 */
export async function removeElementWithUndo<T extends Element>(
  collectionName: string,
  docId: string,
  field: string,
  elementId: string,
  opts: WriteOptions = {},
): Promise<Undoable & { element: T | null }> {
  const removed = await removeElement<T>(collectionName, docId, field, elementId, opts);
  return {
    element: removed?.element ?? null,
    undo: async () => {
      if (!removed) return;
      await insertAt(collectionName, docId, field, removed.element, removed.index, opts);
    },
  };
}
