/**
 * Wedding items: counts and filters (guide §5.22, §4.28; T4, T5).
 *
 * Narrowing by several events or several people shows items with any of the
 * ones chosen; an item for two people shows for either (N12). The items keep their own order (`order.ts`); a sort never
 * changes it.
 */
import { ITEM_PEOPLE, type ItemEvent, type ItemPerson } from "./labels";
import { itemMatches } from "./search";

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

/**
 * Who an item is for, without "General": an item for no one in particular
 * stores none (N12), and one the old screen set to General still reads as that.
 */
export const namedPeople = (persons: readonly ItemPerson[]): ItemPerson[] => persons.filter((p) => p !== "General");

const personLabel = (person: ItemPerson) => ITEM_PEOPLE.find((p) => p.value === person)?.label ?? person;

/** "Groom's father, Groom's mother"; past two, "Bride, Groom's father and 2 more"; for no one, "General" (guide §4.28). */
export function peopleText(persons: readonly ItemPerson[]): string {
  const named = namedPeople(persons);
  if (named.length === 0) return "General";
  const first = named.slice(0, 2).map(personLabel).join(", ");
  return named.length <= 2 ? first : `${first} and ${named.length - 2} more`;
}

/** Everyone named in full, for the picker's label: "Groom's father, Groom's mother, Bride". */
export const peopleNames = (persons: readonly ItemPerson[]): string => {
  const named = namedPeople(persons);
  return named.length ? named.map(personLabel).join(", ") : "General";
};

/**
 * The people after one is ticked (`on`) or unticked. Ticking General, or
 * unticking the last person, leaves it for no one in particular: no people.
 * Saying what it should be rather than flipping it, so Try again never undoes a
 * change that did land.
 */
export const withPerson = (persons: readonly ItemPerson[], person: ItemPerson, on: boolean): ItemPerson[] => {
  const named = namedPeople(persons);
  if (person === "General") return on ? [] : named;
  if (!on) return named.filter((p) => p !== person);
  return named.includes(person) ? named : [...named, person];
};

/** The events after one is switched on or off. */
export const withEvent = (types: readonly ItemEvent[], event: ItemEvent, on: boolean): ItemEvent[] =>
  on ? (types.includes(event) ? [...types] : [...types, event]) : types.filter((e) => e !== event);

/** Whether an item is for one chosen person; "General" is the items for no one in particular. */
export const isFor = (persons: readonly ItemPerson[], person: ItemPerson): boolean =>
  person === "General" ? namedPeople(persons).length === 0 : persons.includes(person);

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
      (!f.people.length || f.people.some((p) => isFor(i.persons, p))),
  );

/** The "To work on next" card: the marked items, up to `limit`, and how many more there are. */
export function workOnNext<T extends ItemRecord>(items: readonly T[], limit = 12) {
  const marked = items.filter((i) => i.next);
  return { shown: marked.slice(0, limit), more: Math.max(0, marked.length - limit) };
}
