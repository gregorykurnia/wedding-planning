/**
 * Money rules (guide §6.9, §4.4, §4.5, §4.8; inventory-notes §5 #1–#5).
 *
 * Still to pay = price − paid, everywhere. Overpaid (paid > price) is never
 * clamped or hidden. What-if amounts never mix into the budget; the only
 * combined number is `projected`. All amounts are whole rupiah and all dates
 * are `YYYY-MM-DD`, with `today` passed in so the functions stay pure.
 */
import { partsOf, rupiah, type Booking, type FunderId, type IsoDate, type Part, type Rupiah } from "./bookings";

/** Due within this many days counts as "due soon". */
export const SOON = 14;

export type Urgency = "late" | "soon" | "later" | "none";

const dayNumber = (iso: IsoDate) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** Whole days from `today` to `iso`; negative when `iso` is in the past. */
export const daysFrom = (iso: IsoDate, today: IsoDate) => dayNumber(iso) - dayNumber(today);

/** Late before today, soon within `SOON` days (today included), none without a date. */
export function urgency(due: IsoDate | null, today: IsoDate): Urgency {
  if (!due) return "none";
  const n = daysFrom(due, today);
  return n < 0 ? "late" : n <= SOON ? "soon" : "later";
}

export const leftOf = (p: { price: Rupiah; paid: Rupiah }) => p.price - p.paid;

export interface Totals {
  price: Rupiah;
  paid: Rupiah;
  /** price − paid; negative when overpaid. */
  left: Rupiah;
  /** The earliest part that still owes money and has a date. */
  next: Part | null;
  /** Every funder named on the parts, in order of first appearance; `null` is Not assigned. */
  funders: FunderId[];
  over: boolean;
  /** The amount over, as a positive number (0 unless overpaid). */
  overBy: Rupiah;
  /** How many parts are overpaid on their own. */
  overParts: number;
}

/** A booking in parts takes everything from its parts (B4). */
export function totals(b: Booking): Totals {
  const ps = partsOf(b);
  const price = ps.reduce((s, p) => s + p.price, 0);
  const paid = ps.reduce((s, p) => s + p.paid, 0);
  const owing = ps
    .filter((p) => p.due && leftOf(p) > 0)
    .sort((a, z) => (a.due as string).localeCompare(z.due as string));
  return {
    price,
    paid,
    left: price - paid,
    next: owing[0] ?? null,
    funders: [...new Set(ps.map((p) => p.funder))],
    over: paid > price,
    overBy: Math.max(paid - price, 0),
    overParts: ps.filter((p) => p.paid > p.price).length,
  };
}

export type PartState = "paid" | "over" | "late" | "due" | "undated" | "unpriced";

/**
 * Which of the part lines in guide §4.8 a part reads as. A part with no price
 * (0 of 0) owes nothing, but it isn't paid in full: it reads "No price yet" (P1-S16).
 */
export function partState(p: Part, today: IsoDate): PartState {
  const left = leftOf(p);
  if (left < 0) return "over";
  if (p.price === 0) return "unpriced";
  if (left === 0) return "paid";
  if (!p.due) return "undated";
  return urgency(p.due, today) === "late" ? "late" : "due";
}

export interface Budget {
  count: number;
  price: Rupiah;
  paid: Rupiah;
  left: Rupiah;
  over: boolean;
  overBy: Rupiah;
  /** Bookings that are overpaid in total. */
  overCount: number;
}

export function budget(bookings: Booking[]): Budget {
  let price = 0;
  let paid = 0;
  let overCount = 0;
  for (const b of bookings) {
    const t = totals(b);
    price += t.price;
    paid += t.paid;
    if (t.over) overCount++;
  }
  return { count: bookings.length, price, paid, left: price - paid, over: paid > price, overBy: Math.max(paid - price, 0), overCount };
}

export interface Due {
  booking: Booking;
  part: Part;
  left: Rupiah;
  due: IsoDate;
  funder: FunderId;
  urgency: Exclude<Urgency, "none">;
}

/** Every unpaid part or booking with a due date, earliest first, then largest. Undated ones never appear. */
export function dues(bookings: Booking[], today: IsoDate): Due[] {
  const out: Due[] = [];
  for (const booking of bookings) {
    for (const part of partsOf(booking)) {
      const left = leftOf(part);
      if (!part.due || left <= 0) continue;
      out.push({ booking, part, left, due: part.due, funder: part.funder, urgency: urgency(part.due, today) as Due["urgency"] });
    }
  }
  return out.sort((a, z) => a.due.localeCompare(z.due) || z.left - a.left);
}

export interface Funder {
  id: string;
  name: string;
}

export interface FunderRow {
  id: FunderId;
  name: string;
  price: Rupiah;
  paid: Rupiah;
  left: Rupiah;
  over: boolean;
  /** How many parts or single bookings this funder carries. */
  count: number;
}

export const NOT_ASSIGNED = "Not assigned";

/**
 * One row per funder, then Not assigned, which shows both paid and still to
 * pay (§5 #4). Costs whose funder isn't in the list land on Not assigned, so
 * the rows always add up to the budget.
 */
export function byFunder(bookings: Booking[], funders: Funder[]): FunderRow[] {
  const rows: FunderRow[] = [
    ...funders.map((f) => ({ id: f.id, name: f.name, price: 0, paid: 0, left: 0, over: false, count: 0 })),
    { id: null, name: NOT_ASSIGNED, price: 0, paid: 0, left: 0, over: false, count: 0 },
  ];
  const unassigned = rows[rows.length - 1];
  for (const b of bookings) {
    for (const p of partsOf(b)) {
      const row = rows.find((r) => r.id !== null && r.id === p.funder) ?? unassigned;
      row.price += p.price;
      row.paid += p.paid;
      row.count++;
    }
  }
  for (const r of rows) {
    r.left = r.price - r.paid;
    r.over = r.paid > r.price;
  }
  return rows;
}

/* ---------- what-if items ---------- */

export interface WhatIfPartRecord {
  id: string;
  name: string;
  totalPrice: Rupiah;
  funder?: FunderId;
}

export interface WhatIfRecord {
  id: string;
  name: string;
  totalPrice: Rupiah;
  funder?: FunderId;
  subEntries?: WhatIfPartRecord[];
}

export interface WhatIfPart {
  id: string | null;
  name: string;
  price: Rupiah;
  funder: FunderId;
}

/** A what-if item's parts, or one line for the item itself. */
export function whatIfParts(w: WhatIfRecord): WhatIfPart[] {
  const own = w.funder ?? null;
  if (w.subEntries && w.subEntries.length > 0) {
    return w.subEntries.map((p) => ({
      id: p.id,
      name: p.name ?? "",
      price: rupiah(p.totalPrice),
      funder: p.funder === undefined ? own : p.funder,
    }));
  }
  return [{ id: null, name: w.name, price: rupiah(w.totalPrice), funder: own }];
}

/** An item's price is always the sum of its parts (§5 #2). */
export const whatIfTotal = (w: WhatIfRecord) => whatIfParts(w).reduce((s, p) => s + p.price, 0);

export interface WhatIfTotals {
  count: number;
  total: Rupiah;
  /** Who would pay the extra: one row per funder with a share, then Not assigned if it has one. */
  byFunder: { id: FunderId; name: string; amount: Rupiah }[];
}

export function whatIfTotals(items: WhatIfRecord[], funders: Funder[]): WhatIfTotals {
  const amounts = new Map<FunderId, Rupiah>();
  let total = 0;
  for (const w of items) {
    for (const p of whatIfParts(w)) {
      const id = p.funder !== null && funders.some((f) => f.id === p.funder) ? p.funder : null;
      amounts.set(id, (amounts.get(id) ?? 0) + p.price);
      total += p.price;
    }
  }
  const rows = funders
    .filter((f) => amounts.has(f.id))
    .map((f) => ({ id: f.id as FunderId, name: f.name, amount: amounts.get(f.id) as Rupiah }));
  if (amounts.has(null)) rows.push({ id: null, name: NOT_ASSIGNED, amount: amounts.get(null) as Rupiah });
  return { count: items.length, total, byFunder: rows };
}

/** The only number that combines real bookings with what-if items. */
export function projected(bookings: Booking[], items: WhatIfRecord[]) {
  const committed = budget(bookings).price;
  const whatIf = items.reduce((s, w) => s + whatIfTotal(w), 0);
  return { committed, whatIf, total: committed + whatIf };
}

/* ---------- collapsing long lists ---------- */

/**
 * Up to `max` items are shown as they are. Past that, `show` are kept and the
 * rest become "and N more". For booking parts, pass `keep` to prefer the ones
 * still owing (guide §4.8); the kept ones stay in their original order.
 */
export function collapse<T>(items: T[], { max = 5, show = 4, keep }: { max?: number; show?: number; keep?: (t: T) => boolean } = {}) {
  if (items.length <= max) return { shown: items, more: 0 };
  const preferred = keep ? items.filter(keep) : items;
  const chosen = new Set(preferred.slice(0, show));
  for (const t of items) {
    if (chosen.size >= show) break;
    chosen.add(t);
  }
  return { shown: items.filter((t) => chosen.has(t)), more: items.length - chosen.size };
}

/** Parts in a ledger: up to 5, else the first 4 still owing and "and N more parts". */
export const collapseParts = (parts: Part[]) => collapse(parts, { keep: (p) => leftOf(p) > 0 });

/* ---------- splitting a single booking ---------- */

/**
 * The parts a single booking becomes (guide §6.9). What's paid becomes a
 * "Deposit", paid in full; the rest becomes a "Balance" with the old due date
 * and next step. If nothing is paid, it becomes one "First payment". Price and
 * paid are kept exactly. The deposit never reads more than the price: what was
 * paid over it goes on a Rp 0 Balance, which reads overpaid (prototype
 * `booking.html`, Phase 5 review S4).
 */
export function splitPlan(b: Booking, makeId: () => string): Part[] {
  const { price, paid, funder, due, step } = b;
  if (paid <= 0) {
    return [{ id: makeId(), name: "First payment", price, paid, funder, due, step }];
  }
  const deposit = Math.min(paid, price);
  const parts: Part[] = [{ id: makeId(), name: "Deposit", price: deposit, paid: deposit, funder, due: null, step: "" }];
  if (price - deposit > 0 || paid > deposit) {
    parts.push({ id: makeId(), name: "Balance", price: price - deposit, paid: paid - deposit, funder, due, step });
  }
  return parts;
}

/* ---------- estimate and payments ---------- */

export interface EstimateDifference {
  estimate: Rupiah;
  price: Rupiah;
  /** price − estimate: positive when the agreed price is higher. */
  difference: Rupiah;
  direction: "higher" | "lower" | "same";
}

/** The agreed price against the comparison estimate (B12); `null` without an estimate. */
export function estimateDifference(b: Booking): EstimateDifference | null {
  if (b.estimate === null) return null;
  const price = totals(b).price;
  const difference = price - b.estimate;
  return { estimate: b.estimate, price, difference, direction: difference > 0 ? "higher" : difference < 0 ? "lower" : "same" };
}

export type PaymentPreview =
  | { kind: "empty" }
  | { kind: "full" }
  | { kind: "partial"; after: Rupiah }
  | { kind: "over"; overBy: Rupiah };

/** What the Record a payment sheet says under the amount: pays in full, still to pay after, or more than what's left. */
export function recordPaymentPreview(left: Rupiah, amount: Rupiah): PaymentPreview {
  if (amount <= 0) return { kind: "empty" };
  const after = left - amount;
  if (after === 0) return { kind: "full" };
  if (after > 0) return { kind: "partial", after };
  return { kind: "over", overBy: -after };
}
