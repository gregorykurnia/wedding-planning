/**
 * The Venues list and a venue's sheet (guide §5.15; F1, F3–F5, F22, B1): a venue
 * as a row needs it, the list in view (filter, order, a page), what the count
 * line and the empty states say, and how "Most guests" is read.
 *
 * Pure: the data hook reads the documents and hands plain values in.
 */
import { group, n0, plural, rp } from "./format";
import { orderVenues, paging, type Direction, type VenueOrderKey } from "./order";
import { filterVenues, known, type VenueFilter } from "./search";
import { VENUE_RULED_OUT, venueStageLabel } from "./labels";

/** What the list reads from a stored venue (the data layer's `VenueDoc` has all of it). */
export interface VenueSource {
  id: string;
  name: string;
  status: string;
  location: string;
  notes: string;
  budgetEstimate: number;
  guestMax: number;
}

/** A venue as the list, the filters, the order and the sheet use it. The stored names stay: the model's filters and orders read them. */
export interface VenueListItem extends VenueSource {
  /** A live booking was made from it. */
  booked: boolean;
  fileCount: number;
}

/** A file on a venue, as its sheet shows it. */
export interface VenueFile {
  /** The `weddingFiles` id; null for a legacy file only on the record. */
  id: string | null;
  name: string;
  url: string;
  size: number | null;
  mime: string;
}

/** A venue as its sheet reads it: the row's values and its files. */
export interface VenueDetail extends VenueListItem {
  files: VenueFile[];
}

export interface VenueExtras {
  booked: boolean;
  fileCount: number;
}

export const venueListItem = (v: VenueSource, extras: VenueExtras): VenueListItem => ({
  id: v.id,
  name: v.name,
  status: v.status,
  location: v.location,
  notes: v.notes,
  budgetEstimate: v.budgetEstimate,
  guestMax: v.guestMax,
  ...extras,
});

/** The estimated cost, or `null` when it was never filled in (a cleared cost is saved as 0). */
export const costOf = (v: Pick<VenueSource, "budgetEstimate">): number | null => (known(v.budgetEstimate) ? v.budgetEstimate : null);

/** The most guests it holds, or `null` when unknown. */
export const capacityOf = (v: Pick<VenueSource, "guestMax">): number | null => (known(v.guestMax) ? v.guestMax : null);

export const isRuledOut = (v: Pick<VenueSource, "status">) => v.status === VENUE_RULED_OUT;

export interface VenueView {
  /** The venues that match, in order. */
  rows: VenueListItem[];
  /** How many of them the page shows. */
  shown: number;
  /** How many more the next page adds. */
  more: number;
  /** Ruled-out venues that fit everything else but are hidden by "Hide ruled out". */
  hidden: number;
}

/** The list in view: the filter, then the order (blanks last), then the first `shown` rows. */
export function venueView(
  venues: readonly VenueListItem[],
  filter: VenueFilter,
  order: { key: VenueOrderKey; direction: Direction },
  shown: number,
  step: number,
): VenueView {
  const rows = orderVenues(filterVenues(venues, filter), order.key, order.direction);
  const hidden = filter.hideRuledOut ? filterVenues(venues, { ...filter, hideRuledOut: false }).length - rows.length : 0;
  const page = paging(rows.length, shown, step);
  return { rows, shown: page.visible, more: page.more, hidden };
}

/** The venues that are booked, in the order they are listed, for the line under the title. */
export const bookedVenues = (venues: readonly VenueListItem[]) => venues.filter((v) => v.booked);

// ---------- the words of the list ----------

/** The line under the title when nothing is booked: "4 venues", or the empty line. */
export const venuesSub = (total: number) => (total === 0 ? "Places you’re weighing up" : plural(total, "venue"));

export const NOTHING_YET = {
  title: "No venues yet",
  body: "Note each venue you hear about with its cost and how many guests it holds, so you can compare them later.",
};

const SHOWN = 40;
const quoted = (typed: string) => {
  const t = typed.trim();
  return `“${t.length > SHOWN ? `${t.slice(0, SHOWN)}…` : t}”`;
};

export const NO_RESULTS_TITLE = "No venues match";

/** "Nothing fits “beach”, at most Rp 200.000.000.": every choice that is narrowing the list. */
export function noResultsBody(f: VenueFilter): string {
  const parts = [
    f.query.trim() ? quoted(f.query) : "",
    f.maxCost != null ? `at most ${rp(f.maxCost)}` : "",
    f.minGuests != null ? `at least ${n0(f.minGuests)} guests` : "",
    f.stage ? `at the stage ${venueStageLabel(f.stage)}` : "",
  ].filter(Boolean);
  return `Nothing fits ${parts.join(", ") || "these choices"}.`;
}

/** "4 venues", "4 venues, 2 ruled out hidden", "12 venues here", "Showing 60 of 302", "302 venues, showing 60". */
export function countText(total: number, shown: number, filtering: boolean, hidden: number): string {
  const tail = hidden ? `, ${n0(hidden)} ruled out hidden` : "";
  if (shown < total) return filtering ? `Showing ${n0(shown)} of ${n0(total)}${tail}` : `${plural(total, "venue")}, showing ${n0(shown)}${tail}`;
  return `${filtering ? `${plural(total, "venue")} here` : plural(total, "venue")}${tail}`;
}

// ---------- a venue's row and sheet ----------

/** The note on a row stops at 140 characters, with an ellipsis. */
/** The sheet's Files, offline before they have arrived (Phase 8 review S2; provisional, G42). */
export const FILES_WAITING = "Its files will show as soon as this device is back online.";

export const NOTE_CUT = 140;
export const noteOnRow = (notes: string) => (notes.length > NOTE_CUT ? `${notes.slice(0, NOTE_CUT - 2)}…` : notes);

export const NO_ESTIMATE = "No estimate";
export const NO_LOCATION = "No location";
export const CAPACITY_UNKNOWN = "Capacity unknown";
export const capacityText = (guests: number) => `Up to ${plural(guests, "guest")}`;

export const addedToast = (name: string) => `Added ${name}`;
export const bookingToast = (name: string) => `${name} is now a booking`;
export const NAME_MISSING = "Give the venue a name.";
/** G27: a venue that wasn't added keeps what was typed, like a vendor that wasn't. */
export const ADD_FAILED = "The venue wasn’t added: the planner lost its connection. Everything you entered is still here.";

// ---------- removing a venue (N10) ----------

export const removeVenueTitle = (name: string) => `Remove ${name}?`;
export const REMOVE_ACTION = "Remove venue";
export const removedToast = (name: string) => `Removed ${name}`;

export interface RemoveFacts {
  name: string;
  hasNotes: boolean;
  fileCount: number;
  booked: boolean;
}

/** What the confirm says (guide §5.15): what leaves with the venue, then what stays, then the undo promise. */
export function removeVenueBody(f: RemoveFacts): string {
  const stays = [
    f.fileCount ? `${f.fileCount === 1 ? "Its file stays" : `Its ${group(f.fileCount)} files stay`} in Files › Venues › ${f.name}.` : "",
    f.booked ? "Its booking stays in the budget." : "",
  ].filter(Boolean);
  return [`It leaves Venues${f.hasNotes ? ", with its notes" : ""}.`, ...stays, "You can undo for a few seconds."].join(" ");
}

// ---------- the guest count ----------

export type GuestsProblem = "words" | "big";

/** A capacity has seven digits at most: past that it is a typing slip. */
const GUESTS_LIMIT = 1e7;

/**
 * Reads "Most guests" and "Holds at least": whole people, with dots or commas only as
 * thousands ("1.200"). A blank field is none. Returns the model's `Read` shape.
 */
export function readGuests(text: string): { ok: true; value: number | null } | { ok: false; problem: GuestsProblem } {
  const typed = String(text ?? "").trim();
  if (!typed) return { ok: true, value: null };
  const digits = /^\d{1,3}([.,\s]\d{3})+$/.test(typed) ? typed.replace(/\D/g, "") : /^\d+$/.test(typed) ? typed : null;
  if (digits === null) return { ok: false, problem: "words" };
  const n = Number(digits);
  return n >= GUESTS_LIMIT ? { ok: false, problem: "big" } : { ok: true, value: n };
}

/** The filter box's reader (`RangeField`): a number, null for blank, undefined for text that isn't one. */
export function readGuestFilter(text: string): number | null | undefined {
  const parsed = readGuests(text);
  return parsed.ok ? parsed.value : undefined;
}

/** What "Most guests" says when it puts the old number back (N16's pattern; G27). */
export function guestsMessage(problem: GuestsProblem, typed: string, before: number | null): string {
  const stays = before === null ? "Nothing was changed." : `It stays ${group(before)}.`;
  return problem === "big"
    ? `That’s more guests than this can hold: up to 9.999.999. ${stays}`
    : `${quoted(typed)} isn’t a number of guests. Use digits, like 250. ${stays}`;
}
