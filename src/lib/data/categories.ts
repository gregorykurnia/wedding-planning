import { collection, doc, getDocs, setDoc, type DocumentData } from "firebase/firestore";
import { BUILT_IN_CATEGORIES, OTHER_CATEGORY, validateCategoryName } from "@/lib/model/categories";
import { withElementIds, type Element } from "./array-ops";
import { requireDb } from "./db";
import { changeMany, listIds, type DocChange } from "./many";
import type { Undoable } from "./undo";
import { create, guarded, stamp, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

/**
 * Rename or remove one of our own categories (F23, guide §5.11). Built-in
 * categories and Other can't be changed. A category is stored as its name on
 * each record, so renaming rewrites the name on every vendor (`category`, and
 * the old UI's `confirmedType`), finalist and package (`type`) and what-if item
 * (`type`) that uses it; removing moves them all to Other. Undo puts the name
 * back on the records that still carry the replacement.
 */
const CATEGORIES = "vendorCategories";
const RECORDS = ["vendors", "shortlist", "hypotheticalItems"];

/** The fields of a record that hold a category name. */
function replaceIn(collection: string, data: DocumentData, from: string, to: string): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (collection === "vendors") {
    if (data.category === from) patch.category = to;
    if (data.confirmedType === from) patch.confirmedType = to;
  } else {
    if (data.type === from) patch.type = to;
  }
  if (collection === "shortlist") {
    const packages = withElementIds<Element>(data.subEntries);
    if (packages.some((p) => p.type === from)) {
      patch.subEntries = packages.map((p) => (p.type === from ? { ...p, type: to } : p));
    }
  }
  return Object.keys(patch).length ? patch : null;
}

async function ours(categoryId: string, database: ReturnType<typeof requireDb>) {
  const snap = await getDocs(collection(database, CATEGORIES));
  const all = snap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? "") }));
  const own = all.find((c) => c.id === categoryId);
  if (!own) throw new WriteError("missing", "That category is gone");
  return { own, others: all.filter((c) => c.id !== categoryId).map((c) => c.name) };
}

/**
 * Puts `from` back only in the fields and packages that held it before and
 * still hold `to`, so a record the partner moved to another category meanwhile
 * stays where they put it.
 */
function undoReplace(changes: DocChange[], from: string, to: string, database: ReturnType<typeof requireDb>) {
  const byDoc = new Map(changes.map((c) => [`${c.collection}/${c.id}`, c.before]));
  return changeMany(
    changes.map(({ collection, id }) => ({ collection, id })),
    (collection, id, data) => {
      const before = byDoc.get(`${collection}/${id}`)!;
      const patch: Record<string, unknown> = {};
      for (const key of ["category", "confirmedType", "type"]) {
        if (before[key] === from && data[key] === to) patch[key] = from;
      }
      if ("subEntries" in before) {
        const was = new Set(
          withElementIds<Element>(before.subEntries)
            .filter((p) => p.type === from)
            .map((p) => p.id),
        );
        const packages = withElementIds<Element>(data.subEntries);
        if (packages.some((p) => was.has(p.id) && p.type === to)) {
          patch.subEntries = packages.map((p) => (was.has(p.id) && p.type === to ? { ...p, type: from } : p));
        }
      }
      return Object.keys(patch).length ? patch : null;
    },
    { db: database },
  );
}

export async function renameCategory(
  categoryId: string,
  newName: string,
  opts: WriteOptions = {},
): Promise<Undoable & { from: string; to: string }> {
  const database = requireDb(opts.db);
  const { own, others } = await ours(categoryId, database);
  const to = newName.trim();
  if (to === own.name) return { from: own.name, to, undo: async () => {} };
  const problem = validateCategoryName(to, [...BUILT_IN_CATEGORIES, ...others, OTHER_CATEGORY]);
  if (problem) throw new WriteError("failed", problem);

  const ref = doc(database, CATEGORIES, categoryId);
  const changes = await changeMany(
    await listIds(RECORDS, { db: database }),
    (collection, _, data) => replaceIn(collection, data, own.name, to),
    {
      db: database,
      alsoWrite: async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new WriteError("missing", "That category is gone");
        tx.update(ref, { name: to, ...stamp(database) });
      },
    },
  );
  return {
    from: own.name,
    to,
    undo: async () => {
      await guarded(() => setDoc(ref, { name: own.name, ...stamp(database) }, { merge: true }));
      await undoReplace(changes, own.name, to, database);
    },
  };
}

/** Removes the category; its vendors and finalists move to Other. */
export async function removeCategory(
  categoryId: string,
  opts: WriteOptions = {},
): Promise<Undoable & { name: string; moved: number }> {
  const database = requireDb(opts.db);
  const { own } = await ours(categoryId, database);
  const ref = doc(database, CATEGORIES, categoryId);
  let removed: DocumentData | null = null;

  const changes = await changeMany(
    await listIds(RECORDS, { db: database }),
    (collection, _, data) => replaceIn(collection, data, own.name, OTHER_CATEGORY),
    {
      db: database,
      alsoWrite: async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new WriteError("missing", "That category is gone");
        removed = snap.data();
        tx.delete(ref);
      },
    },
  );
  return {
    name: own.name,
    moved: changes.length,
    undo: async () => {
      // Same id and createdAt, so it returns to its place in the list.
      const data = removed;
      if (data) await guarded(() => setDoc(ref, { ...data, ...stamp(database) }));
      await undoReplace(changes, own.name, OTHER_CATEGORY, database);
    },
  };
}

/**
 * Adds a category of our own. The name is checked against the list as it is now
 * (built-ins, ours, Other), so a partner's category added a moment ago counts. The
 * id is made by the caller when the form begins, so Try again never adds it twice.
 */
export async function addCategory(id: string, name: string, opts: WriteOptions = {}): Promise<string> {
  const database = requireDb(opts.db);
  const snap = await getDocs(collection(database, CATEGORIES));
  const to = name.trim();
  // A first try that landed after its timeout: this retry has nothing left to add.
  if (snap.docs.some((d) => d.id === id && d.data().name === to)) return to;
  const ours = snap.docs.map((d) => String(d.data().name ?? ""));
  const problem = validateCategoryName(to, [...BUILT_IN_CATEGORIES, ...ours, OTHER_CATEGORY]);
  if (problem) throw new WriteError("failed", problem);
  await create(CATEGORIES, { name: to }, { db: database, id });
  return to;
}
