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
  /** One of the shared categories; an item stored without one reads as Other. */
  category: string;
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
  /** One category's items; "" or left out, every category. */
  category?: string;
}

export const NO_ITEM_FILTER: ItemFilter = { query: "", confirmed: "", events: [], people: [], nextOnly: false, category: "" };

export const isFilteringItems = (f: ItemFilter) =>
  !!(f.query.trim() || f.confirmed || f.events.length || f.people.length || f.nextOnly || f.category);

export const filterItems = <T extends ItemRecord>(items: readonly T[], f: ItemFilter): T[] =>
  items.filter(
    (i) =>
      itemMatches(i, f.query) &&
      (!f.confirmed || (f.confirmed === "yes") === i.confirmed) &&
      (!f.nextOnly || i.next) &&
      (!f.category || i.category === f.category) &&
      (!f.events.length || f.events.some((e) => i.types.includes(e))) &&
      (!f.people.length || f.people.some((p) => isFor(i.persons, p))),
  );

/** The "To work on next" card: the marked items, up to `limit`, and how many more there are. */
export function workOnNext<T extends ItemRecord>(items: readonly T[], limit = 12) {
  const marked = items.filter((i) => i.next);
  return { shown: marked.slice(0, limit), more: Math.max(0, marked.length - limit) };
}

/**
 * The category of each of the common items (§9.2 Q12), by its stored id, so
 * "Start with common items" files them as the wedding items list does
 * (2026-10-25). One that isn't here starts in Other.
 */
export const COMMON_ITEM_CATEGORIES: Readonly<Record<string, string>> = {
  "master-01-reception-venue": "Venue",
  "master-02-church-venue": "Venue",
  "master-03-sangjit-venue": "Venue",
  "master-04-hotel-h-1-venue": "Venue",
  "master-05-wedding-organizer": "Wedding Organizer",
  "master-06-church-food-stalls": "Catering",
  "master-07-ballroom-decoration": "Decoration",
  "master-08-church-decoration": "Decoration",
  "master-09-reception-entertainment": "Entertainment",
  "master-10-photo-and-video-wedding-day": "Photo and Video",
  "master-11-reception-and-wedding-bridal-gown": "Bridal Gown",
  "master-12-groom-suit": "Groom Suit",
  "master-13-wedding-cake": "Wedding Cake",
  "master-14-lighting-led": "Decoration",
  "master-15-reception-mc": "MC",
  "master-16-printed-invitation": "Invitation",
  "master-17-digital-invitation-and-wedding-website": "Invitation",
  "master-18-make-up-artist-bride": "Make Up Artist",
  "master-19-make-up-artist-groom-and-bride-moms": "Make Up Artist",
  "master-20-make-up-artist-sister": "Make Up Artist",
  "master-21-groom-dad-and-brothers-suit": "Family Outfits",
  "master-22-groom-mom-and-sister-dress": "Family Outfits",
  "master-23-bride-dad-and-brothers-suit": "Family Outfits",
  "master-24-bride-mom-dress": "Family Outfits",
  "master-25-groom-shoes": "Shoes and Accessories",
  "master-26-souvenir-for-reception": "Souvenir",
  "master-27-souvenir-for-church": "Souvenir",
  "master-28-sangjit-mc": "MC",
  "master-29-photobooth": "Photobooth",
  "master-30-sangjit-outfit-groom": "Groom Suit",
  "master-31-sangjit-outfit-bride": "Bridal Gown",
  "master-32-wedding-ring": "Rings and Jewelry",
  "master-33-pre-wedding-photographer": "Photo and Video",
  "master-34-groom-parents-chinese-outfit-sangjit": "Family Outfits",
  "master-35-bride-parents-chinese-outfit-sangjit": "Family Outfits",
  "master-36-florist": "Florist",
  "master-37-sangjit-photography": "Photo and Video",
  "master-38-sangjit-videography": "Photo and Video",
  "master-39-transport-pickup": "Transportation",
  "master-40-wedding-car-decor": "Decoration",
  "master-41-civil-registration": "Civil Registration",
  "master-42-bride-wedding-day-jewelry": "Rings and Jewelry",
  "master-43-bridal-accessories": "Shoes and Accessories",
  "master-44-bride-nails": "Shoes and Accessories",
};
