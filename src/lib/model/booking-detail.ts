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
/** N13: the split can't be taken back once a part was changed since; the toast says who, and that both stay. */
export const splitConflict = (partner: string) =>
  `Can’t undo the split: ${partner} has changed a part since. The parts stay as they are now.`;
export const removedToast = (name: string) => `Removed ${name}`;
export const removedTitle = (name: string) => `${name} was removed`;
export const REMOVED_NOTE = "It’s no longer part of the budget.";

export const removePartTitle = (name: string) => `Remove “${name}”?`;
export const removePartBody = (p: Pick<Part, "price" | "paid">) =>
  `Its price of ${rp(p.price)} and ${rp(p.paid)} paid come off this booking’s totals. You can undo for a few seconds.`;

/** "Remove Villa Samaya Ubud?" and what goes with it. */
export const removeBookingTitle = (name: string) => `Remove ${name}?`;
export function removeBookingBody(b: Booking, fileCount: number): string {
  const t = totals(b);
  const what = [
    b.parts.length > 0 ? plural(b.parts.length, "part") : null,
    t.paid ? `${rp(t.paid)} of recorded payments` : null,
    fileCount ? plural(fileCount, "file") : null,
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
