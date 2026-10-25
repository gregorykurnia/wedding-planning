import { collection, doc, getDocs, setDoc, writeBatch, type DocumentData } from "firebase/firestore";
import { DEFAULT_STORED, OTHER_CATEGORY, buildCategories, validateCategoryName } from "@/lib/model/categories";
import { withElementIds, type Element } from "./array-ops";
import { requireDb } from "./db";
import { changeMany, listIds, type DocChange } from "./many";
import type { Undoable } from "./undo";
import { create, guarded, stamp, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

/**
 * Add, rename or remove a category (F23, guide §5.11). Only Other can't be
 * changed. A category is stored as its name on each record, so renaming
 * rewrites the name on every vendor (`category`, and the old UI's
 * `confirmedType`), finalist and package (`type`), what-if item (`type`) and
 * wedding item (`category`) that uses it; removing moves them all to the
 * category chosen, Other unless another is. Undo puts the name back on the
 * records that still carry the replacement.
 */
const CATEGORIES = "vendorCategories";
const RECORDS = ["vendors", "shortlist", "hypotheticalItems", "masterListItems"];

/** The fields of a record that hold a category name. */
function replaceIn(collection: string, data: DocumentData, from: string, to: string): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (collection === "vendors") {
    if (data.category === from) patch.category = to;
    if (data.confirmedType === from) patch.confirmedType = to;
  } else if (collection === "masterListItems") {
    if (data.category === from) patch.category = to;
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

/** Every stored category, or the common ones while none are (`stored` false). */
async function storedCategories(database: ReturnType<typeof requireDb>) {
  const snap = await getDocs(collection(database, CATEGORIES));
  if (snap.empty) return { all: DEFAULT_STORED.map((c) => ({ ...c })), stored: false };
  return { all: snap.docs.map((d) => ({ id: d.id, name: String(d.data().name ?? "") })), stored: true };
}

/**
 * Stores the common categories before the first change to the list, under ids
 * that are the same on every device, so the partner doing the same at the same
 * moment can't double them.
 */
async function storeCommon(database: ReturnType<typeof requireDb>) {
  const batch = writeBatch(database);
  for (const c of DEFAULT_STORED) batch.set(doc(database, CATEGORIES, c.id), { name: c.name, ...stamp(database, true) });
  await guarded(() => batch.commit());
}

async function ours(categoryId: string, database: ReturnType<typeof requireDb>) {
  const { all, stored } = await storedCategories(database);
  const own = all.find((c) => c.id === categoryId);
  if (!own) throw new WriteError("missing", "That category is gone");
  return { own, others: all.filter((c) => c.id !== categoryId).map((c) => c.name), stored };
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
  const { own, others, stored } = await ours(categoryId, database);
  const to = newName.trim();
  if (to === own.name) return { from: own.name, to, undo: async () => {} };
  const problem = validateCategoryName(to, others);
  if (problem) throw new WriteError("failed", problem);
  if (!stored) await storeCommon(database);

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

/**
 * Removes the category; everything in it moves to `moveTo`, Other unless another
 * category is chosen (so two categories that mean the same can be made one).
 */
export async function removeCategory(
  categoryId: string,
  moveTo: string = OTHER_CATEGORY,
  opts: WriteOptions = {},
): Promise<Undoable & { name: string; moved: number; to: string }> {
  const database = requireDb(opts.db);
  const { own, others, stored } = await ours(categoryId, database);
  const to = buildCategories(others).find((c) => c.toLowerCase() === moveTo.trim().toLowerCase());
  if (!to) throw new WriteError("missing", `There's no category called ${moveTo} any more`);
  if (!stored) await storeCommon(database);
  const ref = doc(database, CATEGORIES, categoryId);
  let removed: DocumentData | null = null;

  const changes = await changeMany(
    await listIds(RECORDS, { db: database }),
    (collection, _, data) => replaceIn(collection, data, own.name, to),
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
    to,
    undo: async () => {
      // Same id and createdAt, so it is the same category again.
      const data = removed;
      if (data) await guarded(() => setDoc(ref, { ...data, ...stamp(database) }));
      await undoReplace(changes, own.name, to, database);
    },
  };
}

/**
 * Adds a category. The name is checked against the list as it is now, so a
 * partner's category added a moment ago counts. The id is made by the caller
 * when the form begins, so Try again never adds it twice.
 */
export async function addCategory(id: string, name: string, opts: WriteOptions = {}): Promise<string> {
  const database = requireDb(opts.db);
  const { all, stored } = await storedCategories(database);
  const to = name.trim();
  // A first try that landed after its timeout: this retry has nothing left to add.
  if (all.some((c) => c.id === id && c.name === to)) return to;
  const problem = validateCategoryName(
    to,
    all.map((c) => c.name),
  );
  if (problem) throw new WriteError("failed", problem);
  if (!stored) await storeCommon(database);
  await create(CATEGORIES, { name: to }, { db: database, id });
  return to;
}
