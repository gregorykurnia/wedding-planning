import type { IsoDate } from "@/lib/model/bookings";
import { dateLong, dateShort, dueText, wasDueText } from "@/lib/model/dates";
import { NOT_ASSIGNED, type Due, type Funder } from "@/lib/model/money";
import { veilHref } from "@/veil/href";

// The words of the next card and its after line (guide §4.5). Pure, so the tests
// read them without rendering. `today` is passed in, as everywhere in the model.

/** "Next to pay", or "Next to pay, 1 of 3 late" when more than one dated payment is late. */
export const nextLabel = (lateCount: number) =>
  lateCount > 1 ? `Next to pay, 1 of ${lateCount} late` : "Next to pay";

/** The flag: "5 days late" (rose), "due in 4 days" (gold, within 14 days) or the short date "2 Dec" (calm). */
export function flagText(due: Due, today: IsoDate) {
  return due.urgency === "later" ? dateShort(due.due, today) : dueText(due.due, today);
}

/** "paid by CK", or "no funder yet" when nobody is named. A funder no longer listed reads as Not assigned. */
export function paidByText(funder: string | null, funders: Funder[]) {
  if (funder === null) return "no funder yet";
  return `paid by ${funders.find((f) => f.id === funder)?.name || NOT_ASSIGNED}`;
}

/** The booking's name, with the part's name after it when the booking has parts: "Pelaminan Ayu, final payment". */
export function titleText(due: Due) {
  return due.booking.parts.length > 0
    ? `${due.booking.name}, ${due.part.name.toLowerCase()}`
    : due.booking.name;
}

/** The meta line: "Catering, paid by CK, was due Friday 9 October", or "…, due Wednesday 2 December" when not late. */
export function metaText(due: Due, today: IsoDate, funders: Funder[]) {
  const when = due.urgency === "late" ? wasDueText(due.due, today) : `due ${dateLong(due.due, today)}`;
  return [due.booking.category || "No category", paidByText(due.funder, funders), when].join(", ");
}

/** On the booking's own page (guide §5.6) the card is "Next step": the step, or the part's name when it has none. */
export const STEP_LABEL = "Next step";
export const stepTitle = (due: Due) => due.part.step || due.part.name;

/** "Deposit, paid by CK, due Friday 9 October": the part's name only when the booking has parts, and no category. */
export function stepMeta(due: Due, today: IsoDate, funders: Funder[]) {
  const when = due.urgency === "late" ? wasDueText(due.due, today) : `due ${dateLong(due.due, today)}`;
  const part = due.booking.parts.length > 0 ? `${due.part.name}, ` : "";
  return `${part}${paidByText(due.funder, funders)}, ${when}`;
}

/** A booking's own page in the new UI. The id is `vendor-…` or `venue-…`, as the model has it. */
export const bookingHref = (id: string) => veilHref(`/budget/bookings/${encodeURIComponent(id)}`);

export const RECORD_PAYMENT = "Record payment";
export const NOTHING_DUE = "Nothing due right now";
export const NOTHING_DUE_META =
  "Every booking with a due date is paid up. Give a booking a due date to see it here.";
