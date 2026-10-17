/**
 * The overview (guide §5.2; O1–O5): what the home screen says, worked out from
 * the wedding date, the day planning started and a few counts. Nothing here
 * reads the clock: `today` is a `YYYY-MM-DD` date, so a screen left open
 * overnight stays right.
 */
import { agendaItems, comingUp, type AgendaItem, type EventRecord } from "./agenda";
import type { Booking, IsoDate } from "./bookings";
import { dateLong, dateShort, daysUntil, isIsoDate, timeGone } from "./dates";
import { n0, plural, rp } from "./format";
import type { GuestRecord } from "./guests";
import { headcounts } from "./guests";
import { itemCounts, type ItemRecord } from "./items";
import { budget, dues } from "./money";
import { taskCounts, type TaskRecord } from "./tasks";

/** Where today stands against the wedding: counting down, the day itself, or after (N7, decision 26). */
export type Countdown = { phase: "before"; days: number } | { phase: "day" } | { phase: "after" };

/** `null` until a real wedding date is known. */
export function countdown(wedding: string | null | undefined, today: IsoDate): Countdown | null {
  if (!isIsoDate(wedding)) return null;
  const days = daysUntil(wedding, today);
  if (days > 0) return { phase: "before", days };
  return days === 0 ? { phase: "day" } : { phase: "after" };
}

export interface HeroWords {
  /** The line above the figure: "The wedding day", "Married". */
  kicker: string | null;
  /** The big word or number: "157", "Today". After the wedding there is none. */
  figure: string | null;
  /** The sentence under it. After the wedding it is the day itself, set in serif. */
  context: string;
}

/**
 * The figure and the words around it. Before the day the figure counts down;
 * on the day it is the word "Today"; after it the count simply ends.
 */
export function heroWords(count: Countdown, wedding: IsoDate, today: IsoDate): HeroWords {
  const day = dateLong(wedding, today);
  if (count.phase === "before") {
    return {
      kicker: null,
      figure: n0(count.days),
      context: count.days === 1 ? `day to go: tomorrow, ${day}` : `days until ${day}`,
    };
  }
  if (count.phase === "day") {
    return { kicker: "The wedding day", figure: "Today", context: `${day}. Everything for today is below.` };
  }
  return { kicker: "Married", figure: null, context: day };
}

export interface TimeThread {
  /** 0 to 100. */
  fill: number;
  /** The words for a screen reader. */
  label: string;
  /** The labels under the track. */
  start: string;
  end: string;
}

/**
 * How much of the preparation time has gone. Without the day planning started
 * there is no honest share, so the thread is left out (N8); on the day it is
 * full, and after the wedding there is none.
 */
export function timeThread(count: Countdown, startedOn: string | null | undefined, wedding: IsoDate, today: IsoDate): TimeThread | null {
  const started = isIsoDate(startedOn) ? startedOn : null;
  const start = started ? `Started ${dateShort(started, today)}` : "";
  if (count.phase === "after") return null;
  if (count.phase === "day") return { fill: 100, label: "All of the preparation time has passed", start, end: "The day is here" };
  const gone = timeGone(started, wedding, today);
  if (!gone) return null;
  return {
    fill: gone.percent,
    label: `${gone.percent}% of the preparation time has passed`,
    start,
    end: `${gone.percent}% of the time gone`,
  };
}

/** "Coming up", or "Today and next" on the wedding day. */
export const comingTitle = (count: Countdown | null) => (count?.phase === "day" ? "Today and next" : "Coming up");

export const NOTHING_DATED = "Nothing dated yet. Appointments, payments due and tasks with dates will show here.";

export const NO_DATE = {
  title: "When is the wedding?",
  sub: "Set the date once and every countdown and due date works from it.",
  label: "Wedding date",
  save: "Save the date",
  saving: "Saving",
  demo: "Demonstration mode: saving is turned off.",
  failed: "Couldn’t save the date. What you chose is still here.",
} as const;

export const dateSaved = (date: IsoDate, today: IsoDate) => `Wedding date set to ${dateLong(date, today)}`;

/** The next five things still scheduled, whatever kind, late ones first (O2). */
export function comingFor(
  events: readonly EventRecord[],
  bookings: Booking[],
  tasks: readonly TaskRecord[],
  today: IsoDate,
  limit = 5,
): AgendaItem[] {
  return comingUp(agendaItems(events, dues(bookings, today), tasks), limit);
}

export interface DoorWords {
  id: "budget" | "tasks" | "guests" | "items";
  name: string;
  /** The screen's own path; the caller applies `veilHref`. */
  path: string;
  summary: string;
}

/** The pulse check (O3): one line per area, each a door into its detail (O4). */
export function overviewDoors(input: {
  bookings: Booking[];
  tasks: readonly TaskRecord[];
  guests: readonly GuestRecord[];
  items: readonly ItemRecord[];
}): DoorWords[] {
  const money = budget(input.bookings);
  const t = taskCounts(input.tasks);
  const people = headcounts(input.guests);
  const things = itemCounts(input.items);
  return [
    {
      id: "budget",
      name: "Budget",
      path: "/budget",
      summary: money.count ? `${rp(money.paid)} paid of ${rp(money.price)}` : "Nothing booked yet",
    },
    {
      id: "tasks",
      name: "Tasks",
      path: "/schedule/tasks",
      summary: t.open + t.done ? `${n0(t.done)} of ${plural(t.open + t.done, "task")} done` : "No tasks yet",
    },
    {
      id: "guests",
      name: "Guests",
      path: "/guests",
      summary: people.guests ? `${n0(people.attending)} attending of ${plural(people.guests, "guest")} invited` : "No guests yet",
    },
    {
      id: "items",
      name: "Wedding items",
      path: "/items",
      summary: things.total ? `${n0(things.confirmed)} of ${n0(things.total)} confirmed` : "Nothing tracked yet",
    },
  ];
}
