import type { IsoDate } from "@/lib/model/bookings";
import { monthHeading, parseIso } from "@/lib/model/dates";
import { plural } from "@/lib/model/format";
import { SOON, type Due } from "@/lib/model/money";
import { showingOfText } from "@/veil/parts/tools/tools-text";

// The words and the grouping of the Payments due screen (guide §5.8, B6, S6, O2),
// ported from payments.html. Pure, so the view draws them and the tests read them
// without rendering. `today` is passed in, as everywhere in the model.

/** Payments shown at a time (guide §5.8). */
export const PAGE = 60;

export const NOTHING_TITLE = "Nothing to pay right now";
export const NOTHING_BODY_PAID = "Every booking with a due date is paid up. Bookings without a date don’t show here.";
export const NOTHING_BODY_NONE = "Once you have bookings with due dates, every unpaid amount shows here in date order.";
export const SEE_BOOKINGS = "See bookings";

/** The sentence under "Nothing to pay right now" depends on whether any booking exists. */
export const nothingBody = (hasBookings: boolean) => (hasBookings ? NOTHING_BODY_PAID : NOTHING_BODY_NONE);

const sum = (dues: Due[]) => dues.reduce((total, due) => total + due.left, 0);

/** A piece of the sentence under the figure: words, or an amount the view sets in tabular numerals. */
export type ContextPart = string | { amount: number };

export interface Headline {
  kicker: string;
  /** What's late; if nothing is, what's due soon; else everything on dated bookings. */
  amount: number;
  /** Rose while anything is late. */
  late: boolean;
  /** The sentence under the figure, ending with the total across every payment. */
  context: ContextPart[];
}

/**
 * The hero (guide §5.8, S6): the figure is what's late, or if nothing is, what's
 * due in the next 14 days, or else everything still to pay on dated bookings.
 */
export function headline(dues: Due[]): Headline {
  const late = dues.filter((d) => d.urgency === "late");
  const soon = dues.filter((d) => d.urgency === "soon");
  const all = sum(dues);
  const closing: ContextPart[] = [`. In all, `, { amount: all }, ` across ${plural(dues.length, "payment")}.`];
  if (late.length) {
    return {
      kicker: `Late, across ${plural(late.length, "payment")}`,
      amount: sum(late),
      late: true,
      context: ["and ", { amount: sum(soon) }, ` more due in the next ${SOON} days`, ...closing],
    };
  }
  if (soon.length) {
    return {
      kicker: `Due in the next ${SOON} days`,
      amount: sum(soon),
      late: false,
      context: ["nothing is late", ...closing],
    };
  }
  return {
    kicker: "Still to pay on dated bookings",
    amount: all,
    late: false,
    context: [`nothing is late or due in the next ${SOON} days`, ...closing],
  };
}

export interface DueGroup {
  key: string;
  heading: string;
  /** Late is drawn in rose. */
  late: boolean;
  /** Everything still to pay in the group, even when paging hides some of its rows. */
  total: number;
  dues: Due[];
}

/**
 * Late, then the next 14 days, then one group per month (guide §5.8). The dues
 * arrive earliest first, so the groups come out in date order.
 */
export function groupDues(dues: Due[], today: IsoDate): DueGroup[] {
  const groups: DueGroup[] = [];
  const add = (key: string, heading: string, late: boolean, due: Due) => {
    const found = groups.find((g) => g.key === key);
    if (found) {
      found.dues.push(due);
      found.total += due.left;
    } else {
      groups.push({ key, heading, late, total: due.left, dues: [due] });
    }
  };
  for (const due of dues) {
    if (due.urgency === "late") add("late", "Late", true, due);
    else if (due.urgency === "soon") add("soon", `In the next ${SOON} days`, false, due);
    else {
      const date = parseIso(due.due);
      add(due.due.slice(0, 7), date ? monthHeading(date.year, date.month, today) : due.due, false, due);
    }
  }
  return groups;
}

/** The first `shown` payments across the groups; a group with none left is dropped, its total kept. */
export function visibleGroups(groups: DueGroup[], shown: number): DueGroup[] {
  let room = shown;
  const out: DueGroup[] = [];
  for (const group of groups) {
    if (room <= 0) break;
    const dues = group.dues.slice(0, room);
    room -= dues.length;
    out.push({ ...group, dues });
  }
  return out;
}

/** "Showing 60 of 1.507" once the list pages, nothing when all of it fits. */
export const countText = (total: number, visible: number): string | null =>
  visible < total ? showingOfText(visible, total) : null;
