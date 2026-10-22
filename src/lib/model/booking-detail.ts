import type { Booking, IsoDate, Part } from "./bookings";
import { dateLong } from "./dates";
import { andList, plural, rp } from "./format";
import { estimateDifference, leftOf, totals, urgency, type Due, type EstimateDifference } from "./money";

/**
 * The words and numbers of a booking's own screen (guide §5.6, §6.9). Pure, so
 * the screen only draws and the tests read them without rendering.
 */

/** The hero's kicker, figure and thread (guide §5.6: in parts, overpaid, paid in full). */
export interface BookingFigures {
  kicker: "Overpaid by" | "Paid in full" | "No price yet" | "Still to pay";
  /** The amount shown: what's left, the amount over (positive), or the price when settled. */
  amount: number;
  tone: "over" | "settled" | undefined;
  over: boolean;
  /** The share paid, from 0 to 100. */
  pct: number;
  ends: [string, string];
  /** The thread in words, for a screen reader. */
  label: string;
  price: number;
  paid: number;
}

export function bookingFigures(b: Booking): BookingFigures {
  const t = totals(b);
  const pct = t.price ? Math.max(0, Math.min(100, Math.round((t.paid / t.price) * 100))) : 0;
  const rest = t.over ? "overpaid" : `${100 - pct}% to go`;
  const settled = t.left === 0;
  return {
    kicker: t.over ? "Overpaid by" : settled ? (t.price ? "Paid in full" : "No price yet") : "Still to pay",
    amount: settled ? t.price : Math.abs(t.left),
    tone: t.over ? "over" : settled ? "settled" : undefined,
    over: t.over,
    pct,
    ends: [`${pct}% paid`, rest],
    label: `${pct}% paid, ${rest}`,
    price: t.price,
    paid: t.paid,
  };
}

/** The payment the next card is about: the earliest unpaid part with a date, or none (a booking with nothing due shows no card). */
export function nextDue(b: Booking, today: IsoDate): Due | null {
  const part = totals(b).next;
  if (!part?.due) return null;
  return { booking: b, part, left: leftOf(part), due: part.due, funder: part.funder, urgency: urgency(part.due, today) as Due["urgency"] };
}

/** "Booked from Vendors on Sunday 1 March", "Added directly". An unknown day is left out, never guessed (N8). */
export function originLine(b: Booking, today: IsoDate): string {
  const from = b.from ?? b.kind;
  const base =
    from === "direct"
      ? "Added directly"
      : from === "finalist"
        ? "Booked from the Shortlist"
        : from === "venue"
          ? "Booked from Venues"
          : "Booked from Vendors";
  return b.bookedOn ? `${base} on ${dateLong(b.bookedOn, today)}` : base;
}

/** The estimate sentence under the details (B12), or null without an estimate. */
export function estimateSentence(b: Booking): EstimateDifference | null {
  return estimateDifference(b);
}

/** What the estimate sentence says after "You estimated Rp X while comparing". */
export function estimateTail(d: EstimateDifference): { same: true } | { same: false; amount: string; word: "higher" | "lower" } {
  if (d.direction === "same") return { same: true };
  return { same: false, amount: rp(Math.abs(d.difference)), word: d.direction as "higher" | "lower" };
}

export const STATIC_PARTS = (n: number) => `from ${plural(n, "part")}`;

export const PARTS_SMALL = (n: number) => `${plural(n, "part")}; totals, funders and dates come from them`;
export const PARTS_SMALL_SINGLE = "Paying in instalments or adding extras?";
export const SPLIT_NOTE =
  "Split this booking into parts, each with its own price, payment, funder and due date. What’s already paid becomes the first part.";
export const SPLIT_ACTION = "Split into parts";
export const ADD_PART = "Add a part";
export const REMOVE_PART_ACTION = "Remove part";
export const REMOVE_BOOKING = "Remove this booking";
export const REMOVE_BOOKING_ACTION = "Remove booking";
export const PAID_PART_HINT = "Paid parts don’t need a due date.";
export const ESTIMATE_HINT = "What you noted while comparing. It never changes the agreed price.";
export const NO_ESTIMATE = "No estimate";
export const NEXT_STEP_PLACEHOLDER = "What has to happen next";

export const splitToast = (parts: number) => `Split into ${plural(parts, "part")}`;
/**
 * N13: the split can't be taken back once a part was changed since; the toast says who, what
 * they did and that the parts stay: "Can’t undo the split: Bella recorded Rp 5.000.000 on the
 * balance since. Both parts stay as they are now." `split` is the parts as the split made them
 * and `now` as they are when Undo finds the change (P5-S3). A payment is named with its amount;
 * any other change to one part names the part; otherwise it says a part changed. `who` is the
 * partner's name, or null for your own change (G35/N35), which is never put on the partner.
 */
export function splitConflict(who: string | null, split: readonly Part[], now: readonly Part[]): string {
  const subject = who ?? "you";
  const changed = split
    .map((before) => ({ before, after: now.find((p) => p.id === before.id) }))
    .filter(({ before, after }) => after && !samePart(before, after));
  const stay = now.length === 2 ? "Both parts stay as they are now." : "The parts stay as they are now.";
  const first = changed[0];
  if (changed.length === 1 && first.after) {
    const part = first.after.name.trim().toLowerCase() || "a part";
    const paid = first.after.paid - first.before.paid;
    const what =
      paid > 0
        ? `${subject} recorded ${rp(paid)} on the ${part} since.`
        : `${subject} ${who ? "has" : "have"} changed the ${part} since.`;
    return `Can’t undo the split: ${what} ${stay}`;
  }
  return `Can’t undo the split: ${who ? `${who} has` : "you’ve"} changed a part since. ${stay}`;
}

const samePart = (a: Part, b: Part) =>
  a.name === b.name && a.price === b.price && a.paid === b.paid && a.funder === b.funder && a.due === b.due && a.step === b.step;
export const removedToast = (name: string) => `Removed ${name}`;
export const removedTitle = (name: string) => `${name} was removed`;
export const REMOVED_NOTE = "It’s no longer part of the budget.";

export const removePartTitle = (name: string) => `Remove “${name}”?`;
export const removePartBody = (p: Pick<Part, "price" | "paid">) =>
  `Its price of ${rp(p.price)} and ${rp(p.paid)} paid come off this booking’s totals. You can undo for a few seconds.`;

/** "Remove Villa Samaya Ubud?" and what goes with it. */
export const removeBookingTitle = (name: string) => `Remove ${name}?`;
export function removeBookingBody(b: Booking, fileCount: number | null): string {
  const t = totals(b);
  const what = [
    b.parts.length > 0 ? plural(b.parts.length, "part") : null,
    t.paid ? `${rp(t.paid)} of recorded payments` : null,
    // Null while the files haven't arrived (offline, P7-S15): they go too, uncounted.
    fileCount === null ? "files" : fileCount ? plural(fileCount, "file") : null,
  ].filter((x): x is string => x !== null);
  return `It leaves the budget${what.length ? `, with its ${andList(what)}` : ""}. You can undo for a few seconds.`;
}

/** A split or an added part that didn't go through: nothing changed, so pressing again is safe. */
export const ACTION_FAILED = "That didn’t go through, and nothing was changed. Try again.";

export const SEE_ALL = "See all bookings";
export const NOT_HERE = {
  title: "This booking isn’t here",
  body: "The link may be out of date, or the booking was removed a while ago. Everything else is just where you left it.",
};
export const removedByPartner = (partner: string) => ({
  title: "This booking was removed",
  body: `${partner} removed it on another device a moment ago. It’s no longer part of the budget.`,
});
export const DEMO_NONE = {
  title: "No bookings in demonstration mode",
  body: "The planner isn’t connected to its database yet, so there are no bookings to open.",
};

export const filesHeading = (n: number) => (n ? plural(n, "file") : "None yet");
