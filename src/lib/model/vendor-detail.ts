/**
 * A vendor's own screen (guide §5.12; F7–F11, F13, F16, B1): what the hero's
 * figure says, the words of the price options, the copy card and the removal,
 * and how the rating and the reviewers are read.
 *
 * Pure: the data hook reads the documents and hands plain values in.
 */
import { dec, andList, group, plural, rp } from "./format";
import { VENDOR_RULED_OUT } from "./labels";
import { parseNumber } from "./formulas";

/** One price option as the screen shows it. `name` is the stored `description`. */
export interface PriceOptionView {
  id: string;
  name: string;
  price: number;
  /** What's included, under the name; "" when nothing was written. */
  includes: string;
  /** The one we're leaning towards. */
  leaning: boolean;
}

/** What the screen reads from a stored vendor (the data layer's `VendorDoc` has all of it). */
export interface VendorDetailSource {
  id: string;
  name: string;
  category: string;
  contractStatus: string;
  keen: boolean;
  contactName: string;
  contactPhone: string;
  rating: number | null;
  reviewers: number | null;
  notes: string;
  priceOptions: readonly { id: string; description: string; price: number; includes?: string; selected: boolean }[];
}

export interface VendorFile {
  /** The `weddingFiles` id; null for a legacy file only on the record. */
  id: string | null;
  name: string;
  url: string;
  size: number | null;
  mime: string;
}

export interface VendorExtras {
  /** A live booking was made from it. */
  booked: boolean;
  /** The finalist that is this vendor on the shortlist, if there is one. */
  finalistId: string | null;
  files: VendorFile[];
}

export interface VendorDetail extends VendorExtras {
  id: string;
  name: string;
  category: string;
  /** The stored stage (`contractStatus`). */
  stage: string;
  ruledOut: boolean;
  keen: boolean;
  contactName: string;
  contactPhone: string;
  /** Out of five; a stored 0 was cleared, so it is `null` here. */
  rating: number | null;
  reviewers: number | null;
  notes: string;
  options: PriceOptionView[];
  /** The option we're leaning towards, if one is chosen. */
  leaningId: string | null;
}

export function vendorDetail(v: VendorDetailSource, extras: VendorExtras): VendorDetail {
  const options = v.priceOptions.map((o) => ({
    id: o.id,
    name: o.description,
    price: o.price,
    includes: o.includes ?? "",
    leaning: o.selected,
  }));
  return {
    id: v.id,
    name: v.name,
    category: v.category,
    stage: v.contractStatus,
    ruledOut: v.contractStatus === VENDOR_RULED_OUT,
    keen: v.keen,
    contactName: v.contactName,
    contactPhone: v.contactPhone,
    rating: v.rating != null && v.rating > 0 ? v.rating : null,
    reviewers: v.reviewers,
    notes: v.notes,
    options,
    leaningId: options.find((o) => o.leaning)?.id ?? null,
    ...extras,
  };
}

/** An option with no name was added in a hurry: the screen calls it this. */
export const UNNAMED_OPTION = "Price option";

export const optionName = (o: { name: string }) => o.name.trim() || UNNAMED_OPTION;

// ---------- the hero ----------

export type HeroFigure =
  | { kind: "leaning"; name: string; price: number }
  | { kind: "none"; options: number };

/**
 * The hero's figure is the option we're leaning towards. Without one (or when
 * its price is still 0) there is no price yet, and the screen says how to get one.
 */
export function heroFigure(v: Pick<VendorDetail, "options">): HeroFigure {
  const leaning = v.options.find((o) => o.leaning);
  if (leaning && leaning.price > 0) return { kind: "leaning", name: optionName(leaning), price: leaning.price };
  return { kind: "none", options: v.options.length };
}

export const leaningKicker = (name: string) => `Leaning towards ${name}`;
export const NO_PRICE_KICKER = "No price yet";
export const NO_PRICE_HINT = "Add the prices they give you below, and mark the one you’re leaning towards.";

/** "Chosen, and now a booking." is true while the stage is Chosen or Done. */
export const BOOKING_LINE = "Chosen, and now a booking.";
export const BOOKING_LINE_LATER = "Now a booking.";
export const OPEN_BOOKING = "Open the booking";

export const bookingToast = (name: string) => `${name} is now a booking`;

// ---------- the sections ----------

export const pricesCount = (n: number) => (n ? plural(n, "option") : "");
export const filesCount = (n: number) => (n ? plural(n, "file") : "None yet");

export const NO_OPTIONS = "No prices yet. When they send a price list, add each option here.";

export const optionAddedToast = (name: string) => `Added ${name}`;
/** A price option that wasn't added keeps what was typed (guide §6.1); the line is G24/N24's. */
export const OPTION_ADD_FAILED = "The price option wasn’t added. What you typed is still here.";
export const optionRemovedToast = (name: string) => `Removed ${name}`;

export const optionRemoveTitle = (name: string) => `Remove ${name}?`;

/** The confirm for a price option: what it was, and what happens if it was the one we lean towards. */
export function optionRemoveBody(price: number, leaning: boolean): string {
  const lean = leaning ? ". It’s the one you’re leaning towards, so no price will count until you choose another" : "";
  return `${rp(price)}${lean}. You can undo for a few seconds.`;
}

// ---------- the shortlist card ----------

export const narrowingTitle = (category: string) => `Narrowing down ${category}?`;
export const COPY_NOTE =
  "Copy this vendor to the shortlist with its prices, contact, reviews, notes and files. This vendor stays exactly as it is.";
export const ON_SHORTLIST = "On the shortlist";
export const ON_SHORTLIST_NOTE =
  "The shortlist has its own copy, so you can compare packages there without changing this vendor. New files here appear there too.";
export const copiedToast = (name: string) => `Copied ${name} to the shortlist`;
export const COPY_FAILED = "Couldn’t copy to the shortlist. Nothing was changed.";

// ---------- removing the vendor (N10) ----------

export const removeVendorTitle = (name: string) => `Remove ${name}?`;

export interface RemoveFacts {
  name: string;
  optionCount: number;
  hasNotes: boolean;
  fileCount: number;
  onShortlist: boolean;
  booked: boolean;
}

/**
 * What the confirm says (N10): what leaves with the vendor, then what stays
 * (its files in Files, its shortlist copy, its booking), then the undo promise.
 */
export function removeVendorBody(f: RemoveFacts): string {
  const goes = [f.optionCount ? plural(f.optionCount, "price option") : null, f.hasNotes ? "notes" : null].filter(
    (x): x is string => x !== null,
  );
  const stays = [
    f.fileCount ? `${f.fileCount === 1 ? "Its file stays" : `Its ${group(f.fileCount)} files stay`} in Files › Vendors › ${f.name}.` : "",
    f.onShortlist ? "Its copy on the shortlist stays." : "",
    f.booked ? "Its booking stays in the budget." : "",
  ].filter(Boolean);
  return [`It leaves Vendors${goes.length ? `, with its ${andList(goes)}` : ""}.`, ...stays, "You can undo for a few seconds."].join(" ");
}

export const REMOVE_ACTION = "Remove vendor";
export const removedTitle = (name: string) => `${name} was removed`;
export const REMOVED_NOTE = "It’s no longer in Vendors.";
export const removedToast = (name: string) => `Removed ${name}`;
export const SEE_ALL = "See all vendors";

export const NOT_HERE = {
  title: "This vendor isn’t here",
  body: "The link may be out of date, or the vendor was removed a while ago. Everything else is just where you left it.",
};

export const removedByPartner = (partner: string) => ({
  title: "This vendor was removed",
  body: `${partner} removed it on another device a moment ago.`,
});

// ---------- the rating and the reviewers ----------

export type RatingProblem = "words" | "range";
export type CountProblem = "words" | "big";

export type Read<T, P extends string> = { ok: true; value: T | null } | { ok: false; problem: P };

/** A review count has nine digits at most: past that it is a typing slip. */
const COUNT_LIMIT = 1e9;

/**
 * Reads the rating (guide §5.12): "4,8" and "4.8" are 4.8, a blank field is no
 * rating, and anything outside 0 to 5 or not a number is refused. Two decimals are kept.
 */
export function readRating(text: string): Read<number, RatingProblem> {
  const typed = String(text ?? "").trim();
  const parsed = parseNumber(typed);
  if (parsed.blank) return { ok: true, value: null };
  if (parsed.text) return { ok: false, problem: "words" };
  if (parsed.value < 0 || parsed.value > 5) return { ok: false, problem: "range" };
  return { ok: true, value: Math.round(parsed.value * 100) / 100 };
}

/**
 * Reads the number of reviewers: whole people, with dots or commas only as
 * thousands ("1.200"). A blank field is none.
 */
export function readReviewers(text: string): Read<number, CountProblem> {
  const typed = String(text ?? "").trim();
  if (!typed) return { ok: true, value: null };
  const digits = /^\d{1,3}([.,\s]\d{3})+$/.test(typed) ? typed.replace(/\D/g, "") : /^\d+$/.test(typed) ? typed : null;
  if (digits === null) return { ok: false, problem: "words" };
  const n = Number(digits);
  return n >= COUNT_LIMIT ? { ok: false, problem: "big" } : { ok: true, value: n };
}

const SHOWN = 40;
const quoted = (typed: string) => {
  const t = typed.trim();
  return `“${t.length > SHOWN ? `${t.slice(0, SHOWN)}…` : t}”`;
};

/** What the rating field says when it puts the old rating back (N16's pattern: quote it, say what it stays as). */
export function ratingMessage(problem: RatingProblem, typed: string, before: number | null): string {
  const stays = before === null ? "Nothing was changed." : `It stays ${dec(before)}.`;
  return problem === "range"
    ? `${quoted(typed)} is outside the scale. A rating runs from 0 to 5, like 4,8. ${stays}`
    : `${quoted(typed)} isn’t a rating. Use a number from 0 to 5, like 4,8. ${stays}`;
}

export function reviewersMessage(problem: CountProblem, typed: string, before: number | null): string {
  const stays = before === null ? "Nothing was changed." : `It stays ${group(before)}.`;
  return problem === "big"
    ? `That’s more reviewers than this can hold: up to 999.999.999. ${stays}`
    : `${quoted(typed)} isn’t a number of people. Use digits, like 120. ${stays}`;
}
