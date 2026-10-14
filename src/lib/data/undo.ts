import { deleteField, doc, setDoc, type DocumentData } from "firebase/firestore";
import { insertAt, removeElement, type Element } from "./array-ops";
import { requireDb } from "./db";
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
  }, { db: database });
  return {
    data,
    undo: () => guarded(() => setDoc(ref, { ...data, ...stamp(database) })),
  };
}

/**
 * Works out a change from the record as it is now, writes it, and returns an
 * undo that puts the earlier values of those fields back (fields that didn't
 * exist are removed again). Only the fields in the change are touched by
 * either step, so the partner's other edits stay. `change` returning null
 * writes nothing, and its undo does nothing.
 */
export async function patchWithUndo<R = undefined>(
  collectionName: string,
  id: string,
  change: (data: DocumentData) => { patch: Record<string, unknown>; result?: R } | null,
  opts: WriteOptions = {},
): Promise<Undoable & { before: Record<string, unknown>; result: R | undefined; changed: boolean }> {
  const database = requireDb(opts.db);
  const ref = doc(database, collectionName, id);
  const { before, result, changed } = await transact(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new WriteError("missing", `${collectionName}/${id} is gone`);
    const data = snap.data();
    const out = change(data);
    if (!out) return { before: {}, result: undefined, changed: false };
    const previous: Record<string, unknown> = {};
    for (const key of Object.keys(out.patch)) {
      previous[key] = key in data ? data[key] : deleteField();
    }
    tx.update(ref, { ...out.patch, ...stamp(database) });
    return { before: previous, result: out.result, changed: true };
  }, { db: database });
  return {
    before,
    result,
    changed,
    undo: async () => {
      if (!changed) return;
      await transact(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new WriteError("missing", `${collectionName}/${id} is gone`);
        tx.update(ref, { ...before, ...stamp(database) });
      }, { db: database });
    },
  };
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
