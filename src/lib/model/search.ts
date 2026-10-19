/**
 * Search and filters (guide §6.8, §4.12; F4, F12, G5, T5).
 *
 * Search ignores case and accents, so "lumiere" finds "Lumière Décor", and it
 * looks only at the fields each screen names. Filters combine: every active
 * one must match.
 */
import { partsOf, type Booking, type FunderId } from "./bookings";
import { ITEM_PEOPLE, VENUE_RULED_OUT } from "./labels";
import { totals } from "./money";

/** Lower case with accents removed, for comparing text. */
export const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** True when the search is empty, or any of the fields contains it. */
export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = fold(query.trim());
  return !q || fields.some((f) => f != null && fold(f).includes(q));
}

export interface Highlighted {
  text: string;
  match: boolean;
}

/**
 * Where the search matches in `text`, as `[start, end)` offsets into `text` itself,
 * so a match found only by folding (case, accents) still points at the original letters.
 */
export function matchRanges(text: string, query: string): [number, number][] {
  const q = fold(query.trim());
  if (!q) return [];
  let folded = "";
  const at: number[] = [];
  let i = 0;
  for (const ch of text) {
    const f = fold(ch);
    for (let k = 0; k < f.length; k++) at.push(i);
    folded += f;
    i += ch.length;
  }
  const ranges: [number, number][] = [];
  let last = 0;
  for (let from = folded.indexOf(q); from >= 0; from = folded.indexOf(q, from + q.length)) {
    const start = at[from];
    const lastChar = at[from + q.length - 1];
    const end = lastChar + String.fromCodePoint(text.codePointAt(lastChar) ?? 0).length;
    if (start < last) continue;
    ranges.push([start, end]);
    last = end;
  }
  return ranges;
}

/** Cuts `text` into pieces, marking where the search matches (the champagne highlight). */
export function highlight(text: string, query: string): Highlighted[] {
  const out: Highlighted[] = [];
  let last = 0;
  for (const [start, end] of matchRanges(text, query)) {
    if (start > last) out.push({ text: text.slice(last, start), match: false });
    out.push({ text: text.slice(start, end), match: true });
    last = end;
  }
  if (last < text.length) out.push({ text: text.slice(last), match: false });
  return out;
}

export interface GuestSearchFields {
  name: string;
  connection: string;
  country: string;
  allergies: string;
}

/** Names, connections, countries and food notes. */
export const guestMatches = (g: GuestSearchFields, query: string) =>
  matches(query, g.name, g.connection, g.country, g.allergies);

/** Item and vendor names, and who the item is for ("General" when it is for no one in particular, N12). */
export const itemMatches = (i: { item: string; vendor: string; persons: readonly string[] }, query: string) =>
  matches(query, i.item, i.vendor, ...peopleWords(i.persons));

const peopleWords = (persons: readonly string[]): string[] => {
  const named = persons.filter((p) => p !== "General");
  return named.length ? named.map((p) => ITEM_PEOPLE.find((c) => c.value === p)?.label ?? p) : ["General"];
};

export interface VendorSearchFields {
  name: string;
  contactName: string;
  notes: string;
}

/** Names, contact people and notes. */
export const vendorMatches = (v: VendorSearchFields, query: string) => matches(query, v.name, v.contactName, v.notes);

export interface VenueSearchFields {
  name: string;
  location: string;
  notes: string;
}

/** Names, places and notes. */
export const venueMatches = (v: VenueSearchFields, query: string) => matches(query, v.name, v.location, v.notes);

export interface VendorFilter {
  query: string;
  /** A category name, or "" for every category. */
  category: string;
  /** Only the ones we're keen on. */
  keen: boolean;
}

export const NO_VENDOR_FILTER: VendorFilter = { query: "", category: "", keen: false };

export const isFilteringVendors = (f: VendorFilter) => !!(f.query.trim() || f.category || f.keen);

/** A booking added straight from "Add a booking" has no place in the Vendors list (§2.7). */
export const isListedVendor = (v: { booking?: { from: string } | null }) => v.booking?.from !== "direct";

/** A booked venue that was removed from Venues stays in the budget as a direct booking and has no place in the list (N10). */
export const isListedVenue = isListedVendor;

export function filterVendors<
  T extends VendorSearchFields & { category: string; starred: boolean },
>(vendors: readonly T[], f: VendorFilter): T[] {
  return vendors.filter(
    (v) => (!f.category || v.category === f.category) && (!f.keen || v.starred) && vendorMatches(v, f.query),
  );
}

export interface VenueFilter {
  query: string;
  /** A stored venue stage, or "" for any. */
  stage: string;
  /** "Costs at most": venues with no cost are left out while this is set. */
  maxCost: number | null;
  /** "Holds at least … guests": venues with no capacity are left out while this is set. */
  minGuests: number | null;
  /** On by default. */
  hideRuledOut: boolean;
}

export const NO_VENUE_FILTER: VenueFilter = { query: "", stage: "", maxCost: null, minGuests: null, hideRuledOut: true };

/** Anything beyond the default of hiding ruled-out venues. */
export const isFilteringVenues = (f: VenueFilter) =>
  !!(f.query.trim() || f.stage || f.maxCost != null || f.minGuests != null || !f.hideRuledOut);

/** A venue's cost and capacity count only when they're above zero; a cleared number is saved as 0. */
export const known = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

export function filterVenues<T extends VenueSearchFields & { status: string; budgetEstimate: number; guestMax: number }>(
  venues: readonly T[],
  f: VenueFilter,
): T[] {
  return venues.filter(
    (v) =>
      venueMatches(v, f.query) &&
      (!f.stage || v.status === f.stage) &&
      (!f.hideRuledOut || v.status !== VENUE_RULED_OUT) &&
      (f.maxCost == null || (known(v.budgetEstimate) && v.budgetEstimate <= f.maxCost)) &&
      (f.minGuests == null || (known(v.guestMax) && v.guestMax >= f.minGuests)),
  );
}

/**
 * A booking matches on its name, its category, its parts' names and next steps,
 * and its funders' names (guide §5.5). A funder that isn't listed, or none at all,
 * reads as Not assigned, so searching for "Not assigned" finds what has no funder.
 */
export const bookingMatches = (b: Booking, query: string, funderName: (id: FunderId) => string) =>
  matches(
    query,
    b.name,
    b.category,
    ...partsOf(b).flatMap((p) => [p.name, p.step]),
    ...totals(b).funders.map((id) => funderName(id)),
  );
