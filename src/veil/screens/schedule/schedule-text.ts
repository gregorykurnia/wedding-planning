import type { IsoDate } from "@/lib/model/bookings";
import { dateLong } from "@/lib/model/dates";

/** The words of the Schedule and its event sheet (guide §5.19, §6.1, §6.2, §6.12), pure so the tests read them. */

export const SCHEDULE_SUB = "Appointments, calls, payments and tasks, in one line of time";

export const NOTHING_SCHEDULED = {
  title: "Nothing scheduled yet",
  body: "Add appointments, vendor calls and deadlines. Payments due on bookings and tasks with dates appear here by themselves.",
};

/** What the list says when the search or a kind leaves nothing. */
export function noResults(query: string): { title: string; body: string } {
  const q = query.trim();
  return q
    ? { title: `Nothing matches “${q}”`, body: "Search looks through titles, places and notes of everything with a date." }
    : { title: "Nothing here", body: "Nothing of this kind is coming up." };
}

/** The month's chosen day with nothing on it, and the link that adds something there (guide §5.20). */
export const NOTHING_ON_DAY = "Nothing on this day.";
export const ADD_SOMETHING = "Add something";

/**
 * The rose box above the agenda for reminders that can't arrive (N11): the first
 * three names open their sheets, and the rest are counted.
 */
export function reminderBoxText(names: readonly string[]): { lead: string; shown: string[]; rest: string; tail: string } {
  const n = names.length;
  return {
    lead: `${n === 1 ? "1 reminder" : `${n} reminders`} you set before can’t arrive, because reminders now come only in the morning:`,
    shown: names.slice(0, 3),
    rest: n > 3 ? ` and ${n - 3} more` : "",
    tail: ". Choose again for each.",
  };
}

// ---------- the event sheet ----------

export const ADD_TITLE = "Add to the schedule";
export const TITLE_PLACEHOLDER = "For example, Tasting at Sendok Emas";
export const ADD_FAILED = "The event wasn’t added. What you typed is still here.";

/** The line under the sheet's title: when it is, or how it ended. */
export function sheetSub(status: "scheduled" | "completed" | "cancelled", date: IsoDate | null, late: boolean, today: IsoDate): string {
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  if (!date) return "";
  return late ? `Was on ${dateLong(date, today)}` : dateLong(date, today);
}

export const addedToast = (title: string) => `Added ${title}`;
export const deletedToast = (title: string) => `Deleted ${title}`;

/** Provisional: the design words no failure for Mark completed, Cancel it and Back to scheduled (G22/N22). */
export const STATUS_FAILED = "Couldn’t save that change. Nothing was changed. Try again.";

export const STATUS_TOAST = {
  completed: "Marked completed",
  cancelled: "Cancelled",
  scheduled: "Back to scheduled",
} as const;

export const deleteConfirm = (title: string) => ({
  title: `Delete ${title}?`,
  body: "It comes off the schedule for both of you. You can undo for a few seconds.",
  action: "Delete",
});

export const allowedToast = "Notifications allowed on this device";
