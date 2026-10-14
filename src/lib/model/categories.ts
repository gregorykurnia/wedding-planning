/**
 * Vendor categories (F12, F14, F23; implementation plan Q13).
 *
 * The built-in names are the stored ones, kept as they are. Categories we add
 * come after them in the order they were added, and "Other" is always last.
 * Names are compared without regard to case, so "food" and "Food" can't both exist.
 */

export const BUILT_IN_CATEGORIES = [
  "Decoration",
  "Food",
  "Groom Suit",
  "Bride Dress",
  "Invites",
  "Makeup Artist",
  "Music/DJ",
  "Photos and Videos",
  "Transportation",
  "Wedding Cake",
  "Wedding Organizer",
] as const;

/** The catch-all. New records start here, and it can't be renamed or removed. */
export const OTHER_CATEGORY = "Other";

export const MAX_CATEGORY_LENGTH = 40;

/** "All" is the focus chip that shows everything, so it can't be a category. */
const RESERVED = "all";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The characters in a name, counting each letter, emoji or Chinese character once. */
export const nameLength = (name: string) => Array.from(name.trim()).length;

/** How many more characters a new category name can take (the "40 characters left" line). */
export const charactersLeft = (name: string) => MAX_CATEGORY_LENGTH - nameLength(name);

/** Built-ins, then ours in the order they were added, then Other. Duplicates are dropped. */
export function buildCategories(custom: readonly string[]): string[] {
  const seen = new Set([RESERVED, OTHER_CATEGORY.toLowerCase()]);
  const list: string[] = [];
  for (const name of [...BUILT_IN_CATEGORIES, ...custom]) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    list.push(name.trim());
  }
  return [...list, OTHER_CATEGORY];
}

/** The reason a new or renamed category can't use `name`, in the guide's words, or `null` when it can. */
export function validateCategoryName(name: string, existing: readonly string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Give the category a name.";
  if (nameLength(trimmed) > MAX_CATEGORY_LENGTH) return `Keep it to ${MAX_CATEGORY_LENGTH} characters or fewer.`;
  if (trimmed.toLowerCase() === RESERVED) return "“All” is already the choice that shows everything.";
  const taken = existing.find((e) => same(e, trimmed));
  return taken ? `There's already a category called ${taken}.` : null;
}

export type CategoryKind = "built-in" | "ours" | "catch-all";

export interface CategoryRow {
  name: string;
  kind: CategoryKind;
  /** Vendors in it. */
  count: number;
}

/** The rows of the categories sheet: "Ours, 3 vendors", "Catch-all, 2 vendors". */
export function categoryRows(custom: readonly string[], vendors: readonly { category: string }[]): CategoryRow[] {
  const ours = new Set(custom.map((c) => c.trim().toLowerCase()));
  return buildCategories(custom).map((name) => ({
    name,
    kind: name === OTHER_CATEGORY ? "catch-all" : ours.has(name.toLowerCase()) ? "ours" : "built-in",
    count: vendors.filter((v) => v.category === name).length,
  }));
}

/** Position in the category list; a name that isn't in it comes after every one that is. */
export const categoryRank = (categories: readonly string[], name: string) => {
  const i = categories.findIndex((c) => same(c, name));
  return i < 0 ? categories.length : i;
};

/** Only categories that hold something, with their counts, in list order (the focus chips). */
export function focusCategories(categories: readonly string[], records: readonly { category: string }[]) {
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  const known = categories.filter((c) => counts.has(c));
  const extra = [...counts.keys()].filter((c) => !categories.includes(c)).sort((a, z) => a.localeCompare(z));
  return [...known, ...extra].map((name) => ({ name, count: counts.get(name) ?? 0 }));
}
