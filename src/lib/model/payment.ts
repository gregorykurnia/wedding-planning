/**
 * The words and rules of the Record a payment sheet (guide §5.4, §6.9, §4.9).
 * Pure: no Firebase, no React. The sheet itself is `veil/parts/payment/`.
 */
import { partsOf, type Booking, type FunderId, type Part, type Rupiah } from "./bookings";
import { rp } from "./format";
import { leftOf, recordPaymentPreview, totals, type Funder } from "./money";

export const PAYMENT_TITLE = "Record a payment";
export const PAYMENT_ACTION = "Record payment";
export const PAYMENT_BUSY = "Recording";

/** The sheet's line in demonstration mode (prototype `recordPayment`). */
export const DEMO_RECORDING = "Demonstration mode: recording is turned off.";

/**
 * Provisional (G20/N20): the design gives a failed save its Try again button
 * (guide §6.1), but no line for a payment. This is the funder form's wording
 * (G19) for a payment.
 */
export const RECORD_FAILED = "The payment wasn’t recorded. What you typed is still here.";

/** Provisional (G20/N20): the design has no state for a receipt that is still on its way, or one that didn't arrive. */
export const RECEIPT_WAITING = "Waiting for the receipt to finish uploading.";
export const RECEIPT_FAILED = "A receipt didn’t upload. Try again to record the payment with it.";

/** The part a payment goes on: the one asked for, or the booking's next step, or its first part still owing. */
export function paymentPart(booking: Booking, partId?: string | null): Part | null {
  const parts = partsOf(booking);
  if (partId) return parts.find((p) => p.id === partId) ?? null;
  if (booking.parts.length === 0) return parts[0] ?? null;
  const next = totals(booking).next;
  return next ?? parts.find((p) => leftOf(p) > 0) ?? parts[0] ?? null;
}

/** The line under the title: the booking, and for a booking in parts the part, lower case ("Dapur Lestari Catering, balance"). */
export function paymentSub(booking: Booking, part: Part): string {
  return booking.parts.length > 0 ? `${booking.name}, ${part.name.toLowerCase()}` : booking.name;
}

/** What the amount starts as: what's left, or nothing when nothing is left. */
export const startAmount = (part: Part): Rupiah | null => (leftOf(part) > 0 ? leftOf(part) : null);

export interface PreviewLine {
  text: string;
  /** Rose: the amount isn't usable, or it's more than what's left. */
  attention: boolean;
}

/** The line under the amount (guide §5.4). `badAmount` is text that isn't an amount yet. */
export function previewLine(left: Rupiah, amount: Rupiah | null, badAmount: boolean): PreviewLine {
  if (badAmount) return { text: "That isn’t an amount yet", attention: true };
  const preview = recordPaymentPreview(left, amount ?? 0);
  switch (preview.kind) {
    case "empty":
      return { text: "Enter the amount you paid", attention: false };
    case "full":
      return { text: "Pays this in full", attention: false };
    case "partial":
      return { text: `${rp(preview.after)} still to pay after this`, attention: false };
    case "over":
      return { text: `This is ${rp(preview.overBy)} more than what’s left. It will show as overpaid.`, attention: true };
  }
}

/** The toast after recording: "Recorded Rp 55.500.000 for Dapur Lestari Catering". */
export const recordedText = (amount: Rupiah, name: string) => `Recorded ${rp(amount)} for ${name}`;

/** The value of the Not assigned chip: funder ids are document ids, so this can't be one. */
export const NOT_ASSIGNED = "";

export const funderValue = (id: FunderId) => id ?? NOT_ASSIGNED;
export const funderOfValue = (value: string): FunderId => (value === NOT_ASSIGNED ? null : value);

/** Paid by: every funder, then Not assigned (the same order as Who pays). */
export function paidByChoices(funders: readonly Funder[]): { value: string; label: string }[] {
  return [...funders.map((f) => ({ value: f.id, label: f.name })), { value: NOT_ASSIGNED, label: "Not assigned" }];
}

/** Paid by starts as the part's funder; one that has since been removed starts as Not assigned. */
export function startPaidBy(part: Part, funders: readonly Funder[]): string {
  return part.funder !== null && funders.some((f) => f.id === part.funder) ? part.funder : NOT_ASSIGNED;
}
