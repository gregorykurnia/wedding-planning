import type { IsoDate, Part } from "@/lib/model/bookings";
import { dateShort, dueText } from "@/lib/model/dates";
import { plural, rp } from "@/lib/model/format";
import { collapseParts, leftOf, partState } from "@/lib/model/money";

/**
 * The words and tones of parts, menu cards, packages, tallies and carry lines
 * (guide §4.8), ported from the prototype's booking, vendor, guest and what-if
 * markup. Pure, so the components only draw; screens pass `today`.
 */

/** Rose for late and overpaid, sage for paid in full, ink for the rest. */
export type LineTone = "plain" | "late" | "done";

export interface PartLine {
  /** Unique within its list: the part's id, or its place when the booking has no parts. */
  key: string;
  name: string;
  /** The value at the end of the line, such as "Rp 25.000.000, 30 Oct". */
  value: string;
  tone: LineTone;
}

export interface PartLineList {
  lines: PartLine[];
  /** Parts left out of `lines`: "and 36 more parts". */
  more: number;
}

/** A part with no price yet, on a line or in a summary (P1-S16). Same words as a booking's ledger row. */
const NO_PRICE = "No price yet";

/** A part's value on a ledger line (guide §4.8, "Parts in a list"). */
export function partLineValue(part: Part, today: IsoDate): { value: string; tone: LineTone } {
  const left = leftOf(part);
  const state = partState(part, today);
  if (state === "over") return { value: `overpaid by ${rp(-left)}`, tone: "late" };
  if (state === "unpriced") return { value: NO_PRICE, tone: "plain" };
  if (state === "paid") return { value: `paid ${rp(part.paid)}`, tone: "done" };
  if (part.due && state === "late") return { value: `${rp(left)}, was due ${dateShort(part.due, today)}`, tone: "late" };
  if (part.due) return { value: `${rp(left)}, ${dateShort(part.due, today)}`, tone: "plain" };
  return { value: `${rp(left)}, no date`, tone: "plain" };
}

/** A part's status in its summary on a booking (guide §4.8, "Parts on a booking"). */
export function partStatus(part: Part, today: IsoDate): { value: string; tone: LineTone } {
  const left = leftOf(part);
  const state = partState(part, today);
  if (state === "over") return { value: `overpaid by ${rp(-left)}`, tone: "late" };
  if (state === "unpriced") return { value: NO_PRICE, tone: "plain" };
  if (state === "paid") return { value: "paid in full", tone: "done" };
  if (part.due && state === "late") return { value: `${rp(left)} ${dueText(part.due, today)}`, tone: "late" };
  if (part.due) return { value: `${rp(left)} due ${dateShort(part.due, today)}`, tone: "plain" };
  return { value: `${rp(left)} to pay, no date`, tone: "plain" };
}

/**
 * A booking's parts as ledger lines. Up to five are shown as they are; past that,
 * the first four still owing are, and the rest become "and N more parts" (model
 * `collapseParts()`).
 */
export function partLineList(parts: Part[], today: IsoDate): PartLineList {
  const { shown, more } = collapseParts(parts);
  return {
    lines: shown.map((part, index) => ({
      key: part.id ?? `line-${index}`,
      name: part.name,
      ...partLineValue(part, today),
    })),
    more,
  };
}

/** "and 36 more parts", or "and 1 more part". */
export const moreParts = (n: number) => `and ${plural(n, "more part")}`;

/** "and 3 more funders", for the carry lines past eight. */
export const moreFunders = (n: number) => `and ${plural(n, "more funder")}`;
