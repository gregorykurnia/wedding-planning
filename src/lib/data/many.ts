import { collection, doc, getDocs, type DocumentData, type Firestore, type Transaction } from "firebase/firestore";
import { requireDb } from "./db";
import { stamp, transact, type WriteOptions } from "./write";

/**
 * Changes that touch many records at once (removing a funder, renaming or
 * removing a category). The records are listed first, then each is re-read
 * inside a transaction before it's changed, so a change the partner made
 * meanwhile is seen, not overwritten. Firestore allows 500 writes in one
 * transaction, so a very long list is done in several.
 */

export interface DocChange {
  collection: string;
  id: string;
  /** The values the changed fields had, for undo. */
  before: Record<string, unknown>;
}

const PER_TRANSACTION = 400;

/** Every document id in these collections. */
export async function listIds(collections: readonly string[], opts: WriteOptions = {}) {
  const database = requireDb(opts.db);
  const lists = await Promise.all(
    collections.map(async (name) => {
      const snap = await getDocs(collection(database, name));
      return snap.docs.map((d) => ({ collection: name, id: d.id }));
    }),
  );
  return lists.flat();
}

/**
 * Applies `change` to each listed document as it is now. `change` returns the
 * fields to write, or null to leave the document alone. `alsoWrite` runs in
 * the first transaction too (for the funder or category document itself).
 * Returns what changed, with the earlier values.
 */
export async function changeMany(
  targets: readonly { collection: string; id: string }[],
  change: (collection: string, id: string, data: DocumentData) => Record<string, unknown> | null,
  opts: WriteOptions & {
    /** Reads first, then writes: it runs after the listed documents are read. */
    alsoWrite?: (tx: Transaction, database: Firestore) => Promise<void>;
  } = {},
): Promise<DocChange[]> {
  const changes: DocChange[] = [];
  const chunks: (typeof targets)[] = [];
  for (let i = 0; i < targets.length; i += PER_TRANSACTION) chunks.push(targets.slice(i, i + PER_TRANSACTION));
  if (chunks.length === 0) chunks.push([]);

  for (const [index, chunk] of chunks.entries()) {
    const done = await transact(async (tx, database) => {
      const refs = chunk.map((t) => doc(database, t.collection, t.id));
      const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
      if (index === 0 && opts.alsoWrite) await opts.alsoWrite(tx, database);
      const out: DocChange[] = [];
      snaps.forEach((snap, i) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const patch = change(chunk[i].collection, chunk[i].id, data);
        if (!patch) return;
        const before: Record<string, unknown> = {};
        for (const key of Object.keys(patch)) before[key] = data[key] ?? null;
        tx.update(refs[i], { ...patch, ...stamp(database) });
        out.push({ collection: chunk[i].collection, id: chunk[i].id, before });
      });
      return out;
    }, opts);
    changes.push(...done);
  }
  return changes;
}
