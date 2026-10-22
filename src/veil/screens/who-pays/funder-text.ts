import { plural, rp } from "@/lib/model/format";
import { whatIfParts, type FunderRow, type WhatIfRecord } from "@/lib/model/money";

/** The share of the price paid, 0 to 100, for the funder's thread. */
export function paidShare(row: Pick<FunderRow, "price" | "paid">): number {
  if (!row.price) return 0;
  return Math.max(0, Math.min(100, Math.round((row.paid / row.price) * 100)));
}

/** The thread's words for screen readers: "54% paid". */
export const threadLabel = (row: Pick<FunderRow, "price" | "paid">) => `${paidShare(row)}% paid`;

/**
 * The line under a funder's name (guide §5.9): "Paid Rp X of Rp Y", or, with no
 * cost behind it, what that means for this row.
 */
export function metaParts(row: Pick<FunderRow, "id" | "count" | "paid" | "price">):
  | { kind: "paid"; paid: string; price: string }
  | { kind: "none"; text: string } {
  if (row.count) return { kind: "paid", paid: rp(row.paid), price: rp(row.price) };
  return { kind: "none", text: row.id === null ? "Every cost has a funder" : "Nothing assigned yet" };
}

/** The right-hand figure: still to pay, or the amount over in rose (guide §6.9). */
export function restText(row: Pick<FunderRow, "left">): { text: string; over: boolean } {
  return row.left < 0 ? { text: `${rp(-row.left)} overpaid`, over: true } : { text: rp(row.left), over: false };
}

/**
 * The remove confirm's body: what moves, what stays, and the undo window (guide
 * §5.9). `whatIf` counts the what-if items they would pay for, which move to Not
 * assigned too; the guide's sentence names only costs, so that clause is
 * provisional (G36/N36). `null` means the what-if items haven't been read (still
 * loading, or the read failed): the sentence says "any" instead of a count that
 * could be wrong (Phase 5 review S2).
 */
export function removeBody(row: Pick<FunderRow, "count" | "price">, whatIf: number | null = 0): string {
  if (whatIf === null) {
    const any = "any what-if items they pay";
    if (row.count) {
      return `${plural(row.count, "cost")} (${rp(row.price)}) will move to Not assigned, and so will ${any}. Payments already recorded stay as they are. You can undo for a few seconds.`;
    }
    return `No costs are assigned to them; ${any} will move to Not assigned. You can undo for a few seconds.`;
  }
  const items = plural(whatIf, "what-if item");
  if (row.count) {
    const too = whatIf ? `, and so will ${items}` : "";
    return `${plural(row.count, "cost")} (${rp(row.price)}) will move to Not assigned${too}. Payments already recorded stay as they are. You can undo for a few seconds.`;
  }
  if (whatIf) return `${items} will move to Not assigned. You can undo for a few seconds.`;
  return "Nothing is assigned to them. You can undo for a few seconds.";
}

export const removeTitle = (name: string) => `Remove ${name}?`;

/** The line when nothing is booked yet (guide §5.9, `?state=empty`). */
export const NOTHING_BOOKED =
  "Nothing is booked yet, so nobody owes anything. Funders you add here can be chosen on every booking.";

/** The note that closes the screen, once something is booked: the rows add up to the budget. */
export function totalsNote(paid: number, left: number) {
  return { paid: rp(paid), left: rp(left) };
}

export const DEMO_ADDING = "Demonstration mode: adding is turned off.";
export const ADD_PLACEHOLDER = "For example, Tante Lily";

/**
 * Provisional (G19/N19): the design gives a failed add its button, Try again
 * (guide §6.1), but no line for a funder. This is the booking form's wording
 * (`booking-new.html?state=failed`) without its reason.
 */
export const ADD_FAILED = "The funder wasn’t added. What you typed is still here.";

/** How many what-if items the funder pays a part of, or null while they can't be counted. */
export function whatIfCount(items: readonly WhatIfRecord[] | null | undefined, funderId: string): number | null {
  if (!items) return null;
  return items.filter((w) => whatIfParts(w).some((p) => p.funder === funderId)).length;
}
