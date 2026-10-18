/**
 * The What-if items screen and its sheets (guide §5.10; B8–B10): the projected
 * total, who would pay the extra, the items in an order a page at a time, and the
 * words around them.
 *
 * Pure: the data hook reads the documents and hands plain values in.
 */
import type { FunderId, Rupiah } from "./bookings";
import { plural, rp } from "./format";
import { orderWhatIfs, paging, type Direction, type OrderableWhatIf, type WhatIfOrderKey } from "./order";
import { NOT_ASSIGNED, whatIfTotals, type Funder, type WhatIfRecord } from "./money";

/** Items shown at a time (guide §5.10: "pages of 50"). */
export const WHAT_IF_PAGE = 50;

/** The most funders the "who would pay" list names before it counts the rest. */
export const CARRY_SHOWN = 8;

// ---------- the list in view ----------

export interface WhatIfView<T> {
  rows: T[];
  shown: number;
  more: number;
}

/** The items in the chosen order, and the first `shown` of them. */
export function whatIfView<T extends OrderableWhatIf>(
  items: readonly T[],
  funders: readonly Funder[],
  order: { key: WhatIfOrderKey; direction: Direction },
  shown: number,
  step: number,
): WhatIfView<T> {
  const name = (id: FunderId) => (id === null ? NOT_ASSIGNED : (funders.find((f) => f.id === id)?.name ?? NOT_ASSIGNED));
  const rows = orderWhatIfs(items, order.key, order.direction, name);
  const page = paging(rows.length, shown, step);
  return { rows, shown: page.visible, more: page.more };
}

// ---------- the projected total and who would pay ----------

export interface Projection {
  /** The committed price plus every what-if item. */
  total: Rupiah;
  committed: Rupiah;
  whatIf: Rupiah;
  /** How much of the thread is committed, 0 to 100. */
  share: number;
  /** The thread in words, for a screen reader. */
  label: string;
}

export function projection(committed: Rupiah, whatIf: Rupiah): Projection {
  const total = committed + whatIf;
  const share = total > 0 ? Math.round((committed / total) * 100) : 0;
  return { total, committed, whatIf, share, label: `${share}% committed, the rest what-if` };
}

export const KICKER = "If you went ahead with everything here";
export const THREAD_ENDS: [string, string] = ["Committed", "What-if"];
export const CARRY_HEADING = "Who would pay the extra";
export const NOT_ASSIGNED_YET = "Not assigned yet";

export interface CarryRow {
  key: string;
  label: string;
  amount: Rupiah;
}

/** Who would pay the extra, biggest share first: up to eight funders, then the rest counted. */
export function carryRows(
  items: readonly WhatIfRecord[],
  funders: readonly Funder[],
): { rows: CarryRow[]; more: number } {
  const all = whatIfTotals([...items], [...funders])
    .byFunder.map((row) => ({
      key: row.id ?? "not-assigned",
      label: row.id === null ? NOT_ASSIGNED_YET : row.name,
      amount: row.amount,
    }))
    .sort((a, z) => z.amount - a.amount);
  return { rows: all.slice(0, CARRY_SHOWN), more: Math.max(0, all.length - CARRY_SHOWN) };
}

/** "3 items", the small line beside the Items heading. */
export const itemsSmall = (count: number) => plural(count, "item");

// ---------- nothing yet ----------

export const NOTHING_YET = {
  title: "Try an idea before you commit",
  body: "Add something you're weighing up, like fireworks or a second photographer, and see what the total would become. It stays apart from your real bookings.",
};

export const ADD_ACTION = "Add a what-if item";

// ---------- adding and editing ----------

export const ADD_TITLE = "Add a what-if item";
export const EDIT_TITLE = (name: string) => `Edit ${name}`;
export const SHEET_SUB = "Kept apart from your bookings until you decide.";
export const STAGES_ADD = "Paying in stages? Add the item first, then split it into parts.";
export const STAGES_LEAD = "Paying in stages? ";
export const STAGES_TAIL = ", each with its own price and who would pay.";
export const SPLIT_ACTION = "Split into parts";
export const ADD_PART = "Add a part";
export const REMOVE_PART = "Remove";
export const REMOVE_PART_LABEL = (name: string) => `Remove ${name}`;
export const PARTS_SMALL = (count: number) => `${plural(count, "part")}; the price comes from them`;
export const IN_ALL = "in all";
export const addedToast = (name: string) => `Added ${name}`;

/** N28: an item with no name is turned back with this, and what was typed stays. */
export const NAME_MISSING = "Give the what-if item a name.";
/** N28: an item that wasn't added keeps what was typed, like a venue that wasn't. */
export const ADD_FAILED = "The what-if item wasn’t added: the planner lost its connection. Everything you entered is still here.";
/** N28: a split or an added part that didn't go through, as for a booking (N25). */
export const ACTION_FAILED = "That didn’t go through, and nothing was changed. Try again.";

// ---------- removing ----------

export const removeTitle = (name: string) => `Remove ${name}?`;
export const removeBody = (total: Rupiah) => `${rp(total)} comes off the projected total. You can undo for a few seconds.`;
export const REMOVE_ACTION = "Remove item";
export const removedToast = (name: string) => `Removed ${name}`;
