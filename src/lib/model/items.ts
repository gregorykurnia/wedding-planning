/**
 * Wedding items: counts and filters (guide §5.22, §4.28; T4, T5).
 *
 * Narrowing by several events or several people shows items with any of the
 * ones chosen. The items keep their own order (`order.ts`); a sort never
 * changes it.
 */
import { itemMatches } from "./search";
import type { ItemEvent, ItemPerson } from "./labels";

export interface ItemRecord {
  id: string;
  item: string;
  vendor: string;
  confirmed: boolean;
  types: readonly ItemEvent[];
  persons: readonly ItemPerson[];
  next: boolean;
  sortOrder: number;
}

export interface ItemCounts {
  total: number;
  confirmed: number;
  toGo: number;
  /** Marked to work on next. */
  next: number;
  /** Whole percent confirmed; 0 when there are no items. */
  percent: number;
}

export function itemCounts(items: readonly ItemRecord[]): ItemCounts {
  const total = items.length;
  const confirmed = items.filter((i) => i.confirmed).length;
  return {
    total,
    confirmed,
    toGo: total - confirmed,
    next: items.filter((i) => i.next).length,
    percent: total ? Math.round((confirmed / total) * 100) : 0,
  };
}

export interface ItemFilter {
  query: string;
  /** "yes" shows confirmed items, "no" the ones not confirmed yet, "" both. */
  confirmed: "" | "yes" | "no";
  events: readonly ItemEvent[];
  people: readonly ItemPerson[];
  nextOnly: boolean;
}

export const NO_ITEM_FILTER: ItemFilter = { query: "", confirmed: "", events: [], people: [], nextOnly: false };

export const isFilteringItems = (f: ItemFilter) =>
  !!(f.query.trim() || f.confirmed || f.events.length || f.people.length || f.nextOnly);

export const filterItems = <T extends ItemRecord>(items: readonly T[], f: ItemFilter): T[] =>
  items.filter(
    (i) =>
      itemMatches(i, f.query) &&
      (!f.confirmed || (f.confirmed === "yes") === i.confirmed) &&
      (!f.nextOnly || i.next) &&
      (!f.events.length || f.events.some((e) => i.types.includes(e))) &&
      (!f.people.length || f.people.some((p) => i.persons.includes(p))),
  );

/** The "To work on next" card: the marked items, up to `limit`, and how many more there are. */
export function workOnNext<T extends ItemRecord>(items: readonly T[], limit = 12) {
  const marked = items.filter((i) => i.next);
  return { shown: marked.slice(0, limit), more: Math.max(0, marked.length - limit) };
}
