import { doc, type DocumentData } from "firebase/firestore";
import { stamp, transact, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

/**
 * Changes to arrays embedded in a document (booking parts `subEntries`, vendor
 * `priceOptions`, finalist packages `subEntries`, task `subtasks`, payments).
 * Firestore can't update one element in place, so each change reads the
 * latest array inside a transaction and changes only the element it names by
 * id. Two people editing different elements at once both keep their change
 * (inventory-notes §5 #19); a whole-array rewrite from a stale copy would
 * drop one of them.
 */

export type Element = Record<string, unknown> & { id: string };

/**
 * Elements saved without an id (old data) get `legacy-<index>`: the same id
 * on every read, so a screen can name them, and the first transaction that
 * touches the array stores it (inventory-notes §5 #20).
 */
export const legacyElementId = (index: number) => `legacy-${index}`;

export function withElementIds<T extends object>(raw: unknown): (T & { id: string })[] {
  if (!Array.isArray(raw)) return [];
  const out: (T & { id: string })[] = [];
  raw.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null) return;
    const id = (entry as { id?: unknown }).id;
    out.push(
      typeof id === "string" && id
        ? (entry as T & { id: string })
        : ({ ...(entry as T), id: legacyElementId(index) } as T & { id: string }),
    );
  });
  return out;
}

export interface ArrayChange<R> {
  items: Element[];
  result: R;
  /** Other fields of the same document to write in the same transaction. */
  extra?: Record<string, unknown>;
}

/**
 * The general form: reads the document, hands its array (with ids) and data
 * to `change`, and writes back what it returns. Throws `missing` if the
 * document is gone.
 */
export async function mutateArray<R>(
  collectionName: string,
  docId: string,
  field: string,
  change: (items: Element[], data: DocumentData) => ArrayChange<R>,
  opts: WriteOptions = {},
): Promise<R> {
  return transact(async (tx, database) => {
    const ref = doc(database, collectionName, docId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new WriteError("missing", `${collectionName}/${docId} is gone`);
    const data = snap.data();
    const { items, result, extra } = change(withElementIds<Element>(data[field]), data);
    tx.update(ref, { [field]: items, ...extra, ...stamp(database) });
    return result;
  }, opts);
}

/** Adds an element at the end. Adding an id that's already there does nothing, so a retry is safe. */
export function addElement<T extends Element>(
  collectionName: string,
  docId: string,
  field: string,
  element: T,
  opts: WriteOptions = {},
): Promise<T> {
  return insertAt(collectionName, docId, field, element, Number.POSITIVE_INFINITY, opts);
}

/** Inserts an element at `index` (clamped to the array). Idempotent by element id. */
export function insertAt<T extends Element>(
  collectionName: string,
  docId: string,
  field: string,
  element: T,
  index: number,
  opts: WriteOptions = {},
): Promise<T> {
  return mutateArray(
    collectionName,
    docId,
    field,
    (items) => {
      if (items.some((item) => item.id === element.id)) return { items, result: element };
      const at = Math.max(0, Math.min(index, items.length));
      return { items: [...items.slice(0, at), element, ...items.slice(at)], result: element };
    },
    opts,
  );
}

/**
 * Changes one element. `patch` is merged into the latest stored element, or is
 * a function from it to the new element. Throws `missing` if the element is
 * gone.
 */
export function updateElement<T extends Element>(
  collectionName: string,
  docId: string,
  field: string,
  elementId: string,
  patch: Partial<T> | ((element: T) => T),
  opts: WriteOptions = {},
): Promise<{ before: T; after: T }> {
  return mutateArray(
    collectionName,
    docId,
    field,
    (items) => {
      const index = items.findIndex((item) => item.id === elementId);
      if (index < 0) throw new WriteError("missing", `${field} ${elementId} is gone`);
      const before = items[index] as T;
      const after =
        typeof patch === "function" ? patch(before) : ({ ...before, ...patch, id: before.id } as T);
      const next = [...items];
      next[index] = after;
      return { items: next, result: { before, after } };
    },
    opts,
  );
}

/**
 * Removes one element and returns it with its index, so undo can put it back.
 * Returns null if it was already gone (a retried remove).
 */
export function removeElement<T extends Element>(
  collectionName: string,
  docId: string,
  field: string,
  elementId: string,
  opts: WriteOptions = {},
): Promise<{ element: T; index: number } | null> {
  return mutateArray(
    collectionName,
    docId,
    field,
    (items) => {
      const index = items.findIndex((item) => item.id === elementId);
      if (index < 0) return { items, result: null };
      return {
        items: items.filter((item) => item.id !== elementId),
        result: { element: items[index] as T, index },
      };
    },
    opts,
  );
}

/** Moves one element to `toIndex` (clamped). Throws `missing` if it's gone. */
export function moveElement(
  collectionName: string,
  docId: string,
  field: string,
  elementId: string,
  toIndex: number,
  opts: WriteOptions = {},
): Promise<void> {
  return mutateArray(
    collectionName,
    docId,
    field,
    (items) => {
      const from = items.findIndex((item) => item.id === elementId);
      if (from < 0) throw new WriteError("missing", `${field} ${elementId} is gone`);
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
      return { items: next, result: undefined };
    },
    opts,
  );
}
