/**
 * Ordering and paging (guide §6.8, §4.12; F5, F12, F19, G5, T6).
 *
 * "Order by" plus a direction. Numbers start descending (biggest first) and
 * text starts ascending, except where the guide says otherwise. Blanks always
 * go last, whichever way the list runs, and ties fall back to name (vendors) or
 * guest number (guests) in ascending order.
 */
import { categoryRank } from "./categories";
import { GUEST_EVENTS, ITEM_EVENTS, ITEM_PEOPLE, RSVPS, VENDOR_RULED_OUT, VENDOR_STAGES, indexOf, type Choice } from "./labels";

export type Direction = "asc" | "desc";
export type Sortable = string | number | null | undefined;

export interface OrderChoice<K extends string = string> {
  key: K;
  label: string;
  /** The direction the list starts in when this order is chosen. */
  start: Direction;
}

const order = <K extends string>(...rows: [K, string, Direction][]): OrderChoice<K>[] =>
  rows.map(([key, label, start]) => ({ key, label, start }));

export const flip = (d: Direction): Direction => (d === "asc" ? "desc" : "asc");

/** "Ascending" or "Descending", the word on the direction button. */
export const directionWord = (d: Direction) => (d === "asc" ? "Ascending" : "Descending");

export const startDirection = (choices: readonly OrderChoice[], key: string): Direction =>
  choices.find((c) => c.key === key)?.start ?? "asc";

// Text sorts "naturally" (Item 2 before Item 10) and ignores case and accents.
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const isBlank = (v: Sortable): v is null | undefined =>
  v == null || (typeof v === "number" && !Number.isFinite(v)) || (typeof v === "string" && v.trim() === "");

/** A text comparison for tie-breaks and names. */
export const compareText = (a: string, z: string) => collator.compare(a, z);

/**
 * A stable sort on one value. Blanks go last in both directions; a tie falls
 * back to `tie` (always ascending), then to the order the rows came in.
 */
export function sortBy<T>(
  rows: readonly T[],
  get: (row: T) => Sortable,
  direction: Direction,
  tie?: (a: T, z: T) => number,
): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: get(row) }))
    .sort((a, z) => {
      const aBlank = isBlank(a.value);
      const zBlank = isBlank(z.value);
      if (aBlank !== zBlank) return aBlank ? 1 : -1;
      let c = 0;
      if (!aBlank && !zBlank) {
        c =
          typeof a.value === "number" && typeof z.value === "number"
            ? a.value - z.value
            : collator.compare(String(a.value), String(z.value));
      }
      return c * sign || (tie ? tie(a.row, z.row) : 0) || a.index - z.index;
    })
    .map((x) => x.row);
}

/** How many rows to draw, and what the "Show N more" button says (guide §6.8). */
export function paging(total: number, shown: number, step: number) {
  const visible = Math.min(total, shown);
  const more = Math.max(0, Math.min(step, total - visible));
  return { visible, more, hasMore: more > 0 };
}

// ---------- guests (G5) ----------

export type GuestOrderKey = "number" | "name" | "connection" | "country" | "invite" | "sent" | "rsvp" | "plus" | "food";

// Guest number is who came first, so it starts at 1; the other numeric order starts biggest first.
export const GUEST_ORDERS = order<GuestOrderKey>(
  ["number", "Number", "asc"],
  ["name", "Name", "asc"],
  ["connection", "Connection", "asc"],
  ["country", "Country", "asc"],
  ["invite", "Invited to", "asc"],
  ["sent", "Invitation sent", "asc"],
  ["rsvp", "RSVP", "asc"],
  ["plus", "Plus-ones", "desc"],
  ["food", "Food notes", "asc"],
);

export interface GuestOrderable {
  number?: number | null;
  name: string;
  connection: string;
  country: string;
  eventType: string;
  inviteSent: boolean;
  rsvpStatus: string;
  plusOnes: number;
  allergies: string;
}

const guestValue: Record<GuestOrderKey, (g: GuestOrderable) => Sortable> = {
  number: (g) => g.number,
  name: (g) => g.name,
  connection: (g) => g.connection,
  country: (g) => g.country,
  invite: (g) => indexOf(GUEST_EVENTS, g.eventType),
  sent: (g) => (g.inviteSent ? 0 : 1),
  rsvp: (g) => indexOf(RSVPS, g.rsvpStatus),
  plus: (g) => g.plusOnes,
  food: (g) => g.allergies,
};

/** Ties fall back to the guest number, then the name. */
export function orderGuests<T extends GuestOrderable>(guests: readonly T[], key: GuestOrderKey, direction: Direction): T[] {
  const tie = (a: T, z: T) => (a.number ?? Infinity) - (z.number ?? Infinity) || compareText(a.name, z.name);
  return sortBy(guests, guestValue[key], direction, tie);
}

// ---------- wedding items (T6) ----------

export type ItemOrderKey = "own" | "name" | "vendor" | "confirmed" | "events" | "person" | "next";

export const ITEM_ORDERS = order<ItemOrderKey>(
  ["own", "Our order", "asc"],
  ["name", "Item", "asc"],
  ["vendor", "Vendor", "asc"],
  ["confirmed", "Confirmed", "asc"],
  ["events", "Events", "asc"],
  ["person", "Who it's for", "asc"],
  ["next", "Work on next", "asc"],
);

export interface OrderableItem {
  item: string;
  vendor: string;
  confirmed: boolean;
  types: readonly string[];
  persons: readonly string[];
  next: boolean;
  sortOrder: number;
}

/** The list in the order we keep it: by `sortOrder`, rows without one last. */
export const ownOrder = <T extends { sortOrder: number }>(items: readonly T[]): T[] => sortBy(items, (i) => i.sortOrder, "asc");

const firstIndex = (list: readonly Choice[], values: readonly string[]) => {
  const found = values.map((v) => indexOf(list, v)).filter((n) => n >= 0);
  return found.length ? Math.min(...found) : null;
};

const itemValue: Record<Exclude<ItemOrderKey, "own">, (i: OrderableItem) => Sortable> = {
  name: (i) => i.item,
  vendor: (i) => i.vendor,
  confirmed: (i) => (i.confirmed ? 0 : 1),
  events: (i) => firstIndex(ITEM_EVENTS, i.types),
  person: (i) => firstIndex(ITEM_PEOPLE, i.persons),
  next: (i) => (i.next ? 0 : 1),
};

/**
 * A temporary sort: our own order is never changed. Rows that tie stay in
 * our own order, and "own" gives that order back.
 */
export function orderItems<T extends OrderableItem>(items: readonly T[], key: ItemOrderKey, direction: Direction): T[] {
  const own = ownOrder(items);
  return key === "own" ? own : sortBy(own, itemValue[key], direction);
}

// ---------- vendors (F12) ----------

export type VendorOrderKey = "category" | "name" | "stage" | "rating" | "reviewers" | "added";

export const VENDOR_ORDERS = order<VendorOrderKey>(
  ["category", "Category", "asc"],
  ["name", "Name", "asc"],
  ["stage", "Stage", "asc"],
  ["rating", "Rating", "desc"],
  ["reviewers", "Number of reviewers", "desc"],
  ["added", "Date added", "desc"],
);

export interface OrderableVendor {
  name: string;
  category: string;
  contractStatus: string;
  bridestoryRating: number | null;
  bridestoryReviewCount: number | null;
  createdAt: number | null;
}

/** Ruled-out vendors come after every stage on the thread. */
const stageRank = (status: string) => (status === VENDOR_RULED_OUT ? VENDOR_STAGES.length : indexOf(VENDOR_STAGES, status));

/** A rating of 0 means it was cleared (§5 #10), so it counts as blank. */
const ratingValue = (r: number | null) => (r != null && r > 0 ? r : null);

/** `categories` is the shared list (built-ins, ours, Other last); the Category order follows it. */
export function orderVendors<T extends OrderableVendor>(
  vendors: readonly T[],
  key: VendorOrderKey,
  direction: Direction,
  categories: readonly string[],
): T[] {
  const value: Record<VendorOrderKey, (v: T) => Sortable> = {
    category: (v) => categoryRank(categories, v.category),
    name: (v) => v.name,
    stage: (v) => stageRank(v.contractStatus),
    rating: (v) => ratingValue(v.bridestoryRating),
    reviewers: (v) => v.bridestoryReviewCount,
    added: (v) => v.createdAt,
  };
  return sortBy(vendors, value[key], direction, (a, z) => compareText(a.name, z.name));
}

// ---------- venues (F5) ----------

export type VenueOrderKey = "cost" | "capacity" | "name";

export const VENUE_ORDERS = order<VenueOrderKey>(
  ["cost", "Cost", "desc"],
  ["capacity", "Capacity", "desc"],
  ["name", "Name", "asc"],
);

export interface OrderableVenue {
  name: string;
  budgetEstimate: number;
  guestMax: number;
}

/** A cost or capacity of 0 means it was never filled in, so it counts as blank. */
const positive = (n: number) => (n > 0 ? n : null);

export function orderVenues<T extends OrderableVenue>(venues: readonly T[], key: VenueOrderKey, direction: Direction): T[] {
  const value: Record<VenueOrderKey, (v: T) => Sortable> = {
    cost: (v) => positive(v.budgetEstimate),
    capacity: (v) => positive(v.guestMax),
    name: (v) => v.name,
  };
  return sortBy(venues, value[key], direction, (a, z) => compareText(a.name, z.name));
}

// ---------- shortlist (F19) ----------

export type ShortlistOrderKey = "category" | "price" | "reviews" | "followers";

// Price is the one number that starts low to high (guide §5.13).
export const SHORTLIST_ORDERS = order<ShortlistOrderKey>(
  ["category", "Category", "asc"],
  ["price", "Preferred price", "asc"],
  ["reviews", "Reviews", "desc"],
  ["followers", "Instagram followers", "desc"],
);

export interface OrderableFinalist {
  name: string;
  type: string;
  price: number;
  subEntries?: readonly { id: string; price: number }[];
  preferredPackageId?: string | null;
  bridestoryReviewers: number | null;
  igFollowers: number | null;
}

/** The price of the package we're leaning towards; otherwise the finalist's own price. */
export function preferredPrice(f: Pick<OrderableFinalist, "price" | "subEntries" | "preferredPackageId">): number | null {
  const chosen = f.preferredPackageId ? f.subEntries?.find((p) => p.id === f.preferredPackageId) : undefined;
  return positive(chosen ? chosen.price : f.price);
}

export function orderFinalists<T extends OrderableFinalist>(
  finalists: readonly T[],
  key: ShortlistOrderKey,
  direction: Direction,
  categories: readonly string[],
): T[] {
  const value: Record<ShortlistOrderKey, (f: T) => Sortable> = {
    category: (f) => categoryRank(categories, f.type),
    price: preferredPrice,
    reviews: (f) => f.bridestoryReviewers,
    followers: (f) => f.igFollowers,
  };
  return sortBy(finalists, value[key], direction, (a, z) => compareText(a.name, z.name));
}
