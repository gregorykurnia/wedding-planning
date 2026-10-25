/**
 * Categories (F12, F14, F23; implementation plan Q13), shared by vendors,
 * finalists, bookings, what-if items and wedding items.
 *
 * Every category is stored and can be renamed or removed, except "Other", the
 * catch-all, which is always last. Until one is stored the list is the common
 * ones below, named after the wedding items; the first change stores them.
 * The list runs A to Z. Names are compared without regard to case, so "food"
 * and "Food" can't both exist.
 */

/** The categories a new list starts with (the wedding items' own words, 2026-10-25). */
export const DEFAULT_CATEGORIES = [
  "Bridal Gown",
  "Catering",
  "Civil Registration",
  "Decoration",
  "Entertainment",
  "Family Outfits",
  "Florist",
  "Groom Suit",
  "Invitation",
  "Make Up Artist",
  "MC",
  "Photo and Video",
  "Photobooth",
  "Rings and Jewelry",
  "Shoes and Accessories",
  "Souvenir",
  "Transportation",
  "Venue",
  "Wedding Cake",
  "Wedding Organizer",
] as const;

/** The catch-all. New records start here, and it can't be renamed or removed. */
export const OTHER_CATEGORY = "Other";

export const MAX_CATEGORY_LENGTH = 40;

/** "All" is the focus chip that shows everything, so it can't be a category. */
const RESERVED = "all";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A category as it is stored, or as it will be when the common ones are first stored. */
export interface StoredCategory {
  id: string;
  name: string;
}

/** The id a common category is stored under, the same on every device, so storing them twice can't double them. */
export const defaultCategoryId = (name: string) =>
  `default-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

/** The common categories, as they will be stored. */
export const DEFAULT_STORED: readonly StoredCategory[] = DEFAULT_CATEGORIES.map((name) => ({ id: defaultCategoryId(name), name }));

/** The stored categories, or the common ones while none are stored. */
export const storedOrDefault = (stored: readonly StoredCategory[]): readonly StoredCategory[] =>
  stored.length ? stored : DEFAULT_STORED;

/** The characters in a name, counting each letter, emoji or Chinese character once. */
export const nameLength = (name: string) => Array.from(name.trim()).length;

/** How many more characters a new category name can take (the "40 characters left" line). */
export const charactersLeft = (name: string) => MAX_CATEGORY_LENGTH - nameLength(name);

/** The categories A to Z, then Other. Duplicates, blanks and "All" are dropped. */
export function buildCategories(names: readonly string[]): string[] {
  const seen = new Set([RESERVED, OTHER_CATEGORY.toLowerCase()]);
  const list: string[] = [];
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    list.push(name.trim());
  }
  list.sort((a, z) => a.localeCompare(z, undefined, { sensitivity: "base" }));
  return [...list, OTHER_CATEGORY];
}

/** The reason a new or renamed category can't use `name`, in the guide's words, or `null` when it can. */
export function validateCategoryName(name: string, existing: readonly string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Give the category a name.";
  if (nameLength(trimmed) > MAX_CATEGORY_LENGTH) return `Keep it to ${MAX_CATEGORY_LENGTH} characters or fewer.`;
  if (trimmed.toLowerCase() === RESERVED) return "“All” is already the choice that shows everything.";
  const taken = [...existing, OTHER_CATEGORY].find((e) => same(e, trimmed));
  return taken ? `There's already a category called ${taken}.` : null;
}

export interface CategoryRow {
  name: string;
  /** Stored under; null for Other, which can't be changed. */
  id: string | null;
  /** Vendors in it. */
  vendors: number;
  /** Wedding items in it. */
  items: number;
}

const tally = (records: readonly { category: string }[]) => {
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  return counts;
};

/** The rows of the categories sheet, A to Z with Other last, each with what's in it. */
export function categoryRows(
  stored: readonly StoredCategory[],
  vendors: readonly { category: string }[],
  items: readonly { category: string }[] = [],
): CategoryRow[] {
  const known = storedOrDefault(stored);
  const inVendors = tally(vendors);
  const inItems = tally(items);
  return buildCategories(known.map((c) => c.name)).map((name) => ({
    name,
    id: name === OTHER_CATEGORY ? null : (known.find((c) => same(c.name, name))?.id ?? null),
    vendors: inVendors.get(name) ?? 0,
    items: inItems.get(name) ?? 0,
  }));
}

/** Position in the category list; a name that isn't in it comes after every one that is. */
export const categoryRank = (categories: readonly string[], name: string) => {
  const i = categories.findIndex((c) => same(c, name));
  return i < 0 ? categories.length : i;
};

/** Only categories that hold something, with their counts, in list order (the focus chips). */
export function focusCategories(categories: readonly string[], records: readonly { category: string }[]) {
  const counts = tally(records);
  const known = categories.filter((c) => counts.has(c));
  const extra = [...counts.keys()].filter((c) => !categories.includes(c)).sort((a, z) => a.localeCompare(z));
  return [...known, ...extra].map((name) => ({ name, count: counts.get(name) ?? 0 }));
}

/** The list a picker offers: every category, plus the record's own if it isn't one (so it still shows). */
export const choicesWith = (categories: readonly string[], current: string): string[] =>
  !current || categories.some((c) => same(c, current)) ? [...categories] : [...categories.slice(0, -1), current, OTHER_CATEGORY];

/** The list everything offers: the stored categories (or the common ones while none are), A to Z, then Other. */
export const categoryList = (stored: readonly StoredCategory[]): string[] =>
  buildCategories(storedOrDefault(stored).map((c) => c.name));
