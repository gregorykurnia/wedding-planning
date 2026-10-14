import { doc, setDoc, type DocumentData } from "firebase/firestore";
import { withElementIds, type Element } from "./array-ops";
import { requireDb } from "./db";
import { changeMany, listIds } from "./many";
import { patchWithUndo, type Undoable } from "./undo";
import { guarded, stamp, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

/**
 * Remove a funder (guide §5.9, B11). Its costs move to Not assigned: every
 * booking, part and what-if item that names it gets `funder: null`. Payments
 * already recorded keep the funder they were paid by. Undo puts the funder
 * back with the same id and order, and gives each record its funder again,
 * unless the partner has given it another one meanwhile.
 */
const RECORDS = ["vendors", "venues", "hypotheticalItems"];

export async function removeFunder(funderId: string, opts: WriteOptions = {}): Promise<Undoable & { moved: number }> {
  const database = requireDb(opts.db);
  const funderRef = doc(database, "funders", funderId);
  let removed: DocumentData | null = null;

  const changes = await changeMany(
    await listIds(RECORDS, { db: database }),
    (_, __, data) => {
      const patch: Record<string, unknown> = {};
      if (data.funder === funderId) patch.funder = null;
      const parts = withElementIds<Element>(data.subEntries);
      if (parts.some((p) => p.funder === funderId)) {
        patch.subEntries = parts.map((p) => (p.funder === funderId ? { ...p, funder: null } : p));
      }
      return Object.keys(patch).length ? patch : null;
    },
    {
      db: database,
      alsoWrite: async (tx) => {
        const snap = await tx.get(funderRef);
        removed = snap.exists() ? snap.data() : null;
        if (snap.exists()) tx.delete(funderRef);
      },
    },
  );

  // How many costs moved: parts count one each, a record without parts one.
  const moved = changes.reduce((sum, c) => {
    const before = c.before.subEntries;
    const parts = withElementIds<Element>(before).filter((p) => p.funder === funderId).length;
    return sum + (parts || (c.before.funder === funderId ? 1 : 0));
  }, 0);

  return {
    moved,
    undo: async () => {
      if (removed) {
        const data = removed;
        await guarded(() => setDoc(funderRef, { ...data, ...stamp(database) }));
      }
      const byDoc = new Map(changes.map((c) => [`${c.collection}/${c.id}`, c]));
      await changeMany(
        changes.map(({ collection, id }) => ({ collection, id })),
        (collection, id, data) => {
          const c = byDoc.get(`${collection}/${id}`)!;
          const patch: Record<string, unknown> = {};
          if (c.before.funder === funderId && data.funder === null) patch.funder = funderId;
          if ("subEntries" in c.before) {
            const was = new Set(
              withElementIds<Element>(c.before.subEntries)
                .filter((p) => p.funder === funderId)
                .map((p) => p.id),
            );
            const parts = withElementIds<Element>(data.subEntries);
            if (parts.some((p) => was.has(p.id) && p.funder === null)) {
              patch.subEntries = parts.map((p) => (was.has(p.id) && p.funder === null ? { ...p, funder: funderId } : p));
            }
          }
          return Object.keys(patch).length ? patch : null;
        },
        { db: database },
      );
    },
  };
}

/** Renames a funder, with undo. Names are trimmed; an empty name keeps the old one. */
export async function renameFunderWithUndo(funderId: string, name: string, opts: WriteOptions = {}): Promise<Undoable> {
  const trimmed = name.trim();
  if (!trimmed) throw new WriteError("failed", "A funder needs a name");
  return patchWithUndo("funders", funderId, (data) => (data.name === trimmed ? null : { patch: { name: trimmed } }), opts);
}
