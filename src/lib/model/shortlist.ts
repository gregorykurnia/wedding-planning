/**
 * The Shortlist (guide §5.13; F17–F19, F21): a finalist as its card needs it,
 * the list in view (category, then order, then a page), the category headings
 * and the words on the card.
 *
 * Pure: the data hook reads the documents and hands plain values in.
 */
import { focusCategories } from "./categories";
import { compact, cut, plural } from "./format";
import { orderFinalists, paging, type Direction, type ShortlistOrderKey } from "./order";

/** What the list reads from a stored finalist (the data layer's `FinalistDoc` has all of it). */
export interface FinalistSource {
  id: string;
  name: string;
  category: string;
  /** The finalist's own price and description first, then the stored packages. */
  packages: readonly { id: string; name: string; price: number }[];
  preferredPackageId: string;
  reviewers: number | null;
  igFollowers: number | null;
  step: string;
  movedTo: { kind: string } | null;
}

export interface FinalistPackage {
  id: string;
  name: string;
  price: number;
  /** The package we're leaning towards. */
  preferred: boolean;
}

/** A finalist as the shortlist, the filters and the orders use it. */
export interface FinalistListItem {
  id: string;
  name: string;
  category: string;
  /** Every package, in the order they were added. */
  packages: FinalistPackage[];
  reviewers: number | null;
  followers: number | null;
  step: string;
  /** It became a booking; the card fades and says so. */
  booked: boolean;
}

/** A finalist's own price and description are a package only once either is filled in. */
const isPackage = (p: { name: string; price: number }) => p.price > 0 || p.name.trim() !== "";

export function finalistListItem(f: FinalistSource): FinalistListItem {
  const packages = f.packages.filter(isPackage);
  // Preferred falls back to the first one shown when the chosen package is empty or gone.
  const leaning = packages.find((p) => p.id === f.preferredPackageId) ?? packages[0];
  return {
    id: f.id,
    name: f.name,
    category: f.category,
    packages: packages.map((p) => ({ id: p.id, name: p.name, price: p.price, preferred: p === leaning })),
    reviewers: f.reviewers,
    followers: f.igFollowers,
    step: f.step,
    booked: f.movedTo?.kind === "booking",
  };
}

/** How many packages a card lists before "and 26 more packages". */
export const CARD_PACKAGES = 4;

/** The line under the title: "6 finalists in 4 categories", or the empty line. */
export function shortlistSub(finalists: readonly { category: string }[]): string {
  if (finalists.length === 0) return "Finalists, side by side";
  const categories = new Set(finalists.map((f) => f.category)).size;
  return `${plural(finalists.length, "finalist")} in ${plural(categories, "category", "categories")}`;
}

/** "120 reviews, 12,3k followers"; whichever is known, or "No reviews or followers yet". */
export function finalistMeta(f: Pick<FinalistListItem, "reviewers" | "followers">): string {
  const parts = [
    f.reviewers != null ? plural(f.reviewers, "review") : "",
    f.followers != null ? `${compact(f.followers)} followers` : "",
  ].filter(Boolean);
  return parts.join(", ") || "No reviews or followers yet";
}

/** The foot of a card: the next step cut at 120 characters, or that there is none. */
export const STEP_CUT = 120;
export const noStep = "No next step";
export const stepText = (step: string): string | null => (step.trim() ? cut(step.trim(), STEP_CUT) : null);

/** "and 26 more packages", for the packages a card doesn't list; `null` when it lists them all. */
export function morePackages(count: number): string | null {
  return count > CARD_PACKAGES ? `and ${plural(count - CARD_PACKAGES, "more package")}` : null;
}

export interface ShortlistFilter {
  /** A category name, or "" for all. */
  category: string;
}

export interface ShortlistView {
  /** The finalists in the category, in order. */
  rows: FinalistListItem[];
  /** How many of them the page shows. */
  shown: number;
  /** How many more the next page adds. */
  more: number;
}

/**
 * The shortlist in view: the category, then the order (blanks last, ties by
 * name), then the first `shown` cards. A price order starts low to high,
 * reviews and followers high to low (the model's choices say so).
 */
export function shortlistView(
  finalists: readonly FinalistListItem[],
  filter: ShortlistFilter,
  order: { key: ShortlistOrderKey; direction: Direction },
  categories: readonly string[],
  shown: number,
  step: number,
): ShortlistView {
  const inCategory = finalists.filter((f) => !filter.category || f.category === filter.category);
  const rows = orderFinalistItems(inCategory, order.key, order.direction, categories);
  const page = paging(rows.length, shown, step);
  return { rows, shown: page.visible, more: page.more };
}

/** `orderFinalists` reads the stored shape; this hands it the card's fields. */
export function orderFinalistItems(
  items: readonly FinalistListItem[],
  key: ShortlistOrderKey,
  direction: Direction,
  categories: readonly string[],
): FinalistListItem[] {
  const keyed = items.map((item) => ({
    item,
    name: item.name,
    type: item.category,
    price: 0,
    // Every package, own price included, so the leaning one's price is found by its id.
    subEntries: item.packages,
    preferredPackageId: item.packages.find((p) => p.preferred)?.id ?? null,
    bridestoryReviewers: item.reviewers,
    igFollowers: item.followers,
  }));
  return orderFinalists(keyed, key, direction, categories).map((k) => k.item);
}

export interface FinalistGroup {
  category: string;
  /** Every finalist in this category among the matches, not only the ones on the page. */
  count: number;
  rows: FinalistListItem[];
}

/** The page's cards under their category headings, in the order the cards run. */
export function groupFinalists(matches: readonly FinalistListItem[], page: readonly FinalistListItem[]): FinalistGroup[] {
  const totals = new Map<string, number>();
  for (const f of matches) totals.set(f.category, (totals.get(f.category) ?? 0) + 1);
  const groups: FinalistGroup[] = [];
  for (const f of page) {
    const last = groups[groups.length - 1];
    if (last && last.category === f.category) last.rows.push(f);
    else groups.push({ category: f.category, count: totals.get(f.category) ?? 0, rows: [f] });
  }
  return groups;
}

/** The focus chips: every category that holds a finalist, with its count. */
export const shortlistFocus = (categories: readonly string[], finalists: readonly FinalistListItem[]) =>
  focusCategories(categories, finalists);

// ---------- the words of the screen ----------

export const NOTHING_ON_SHORTLIST = {
  title: "Nothing on the shortlist yet",
  body: "When a category comes down to a few names, copy them here from Vendors to compare their packages side by side. Or add a finalist straight away.",
};

export const finalistCount = (n: number) => plural(n, "finalist");
