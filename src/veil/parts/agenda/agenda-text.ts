import type { AgendaItem } from "@/lib/model/agenda";
import { isLate } from "@/lib/model/agenda";
import type { IsoDate } from "@/lib/model/bookings";
import { dateShort, dueText } from "@/lib/model/dates";
import { plural, rp } from "@/lib/model/format";
import { SCHEDULE_KINDS, labelOf } from "@/lib/model/labels";
import { veilHref } from "@/veil/href";

/**
 * The words and addresses of an agenda row (guide §4.25), ported from the
 * prototype's `row()` in schedule.js. Pure, so the row component only draws.
 */

export interface RowWhen {
  /** The serif line: a time, "All day", "Due", or the date when the thing is late. */
  main: string;
  /** The end time under a start time. */
  small: string | null;
}

/** Late things show their date instead of a time (guide §4.25). */
export function rowWhen(item: AgendaItem, today: IsoDate): RowWhen {
  if (isLate(item, today)) return { main: dateShort(item.date, today), small: null };
  if (item.type !== "event") return { main: "Due", small: null };
  if (item.start) return { main: item.start, small: item.end };
  return { main: "All day", small: null };
}

/** "Vendor call" · "Payment" · "Task", then ", completed" or ", cancelled". */
export function rowKind(item: AgendaItem): string {
  const base = item.type === "payment" ? "Payment" : item.type === "task" ? "Task" : labelOf(SCHEDULE_KINDS, item.kind);
  return base + (item.status === "completed" ? ", completed" : item.status === "cancelled" ? ", cancelled" : "");
}

/** "paid by Bella", or "no funder yet" when nobody is named. */
export const paidByText = (funderName: string | null | undefined) => (funderName ? `paid by ${funderName}` : "no funder yet");

/** Only a bare web address is a call link; any other text is a place. */
export const isCallLink = (where: string) => /^https?:\/\/\S+$/.test(where.trim());

/**
 * The line under the title as text: a place, what's left to pay and by whom, or
 * how many steps are done. A call link comes back as `null`, because the row
 * draws it as the link "Join the call".
 */
export function rowSub(item: AgendaItem, funderName?: string | null): string | null {
  if (item.type === "payment") return `${rp(item.amount ?? 0)}, ${paidByText(funderName)}`;
  if (item.type === "task") return item.steps ? `${item.steps.done} of ${plural(item.steps.total, "step")} done` : null;
  return item.where && !isCallLink(item.where) ? item.where : null;
}

/** "3 days late" for a late thing; `null` for any other. */
export const lateFlag = (item: AgendaItem, today: IsoDate) => (isLate(item, today) ? dueText(item.date, today) : null);

/** Where a payment or a task lives; an event opens its sheet instead. */
export function recordHref(item: AgendaItem): string | null {
  if (item.type === "payment") return veilHref(`/budget/bookings/${encodeURIComponent(item.id)}`);
  if (item.type === "task") return veilHref(`/schedule/tasks?open=${encodeURIComponent(item.id)}`);
  return null;
}
