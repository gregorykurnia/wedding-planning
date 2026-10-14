/**
 * Dates and relative time (guide §6.11; inventory-notes §5 #37).
 *
 * Every function takes `today` as a `YYYY-MM-DD` date in the local calendar, so
 * nothing here reads the clock. Months are 1 to 12. The year shows only when it
 * isn't the same as today's.
 */
import type { IsoDate } from "./bookings";
import { plural } from "./format";
import { SOON, daysFrom } from "./money";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/** The parts of a real calendar date, or `null` for anything else ("2026-02-30", "soon", ""). */
export function parseIso(iso: string | null | undefined): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  const real = check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
  return real ? { year, month, day } : null;
}

export const isIsoDate = (iso: string | null | undefined): iso is IsoDate => parseIso(iso) !== null;

export const toIso = (year: number, month: number, day: number): IsoDate => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

/** A `Date`'s calendar day in the local time zone. */
export const localIso = (date: Date): IsoDate => toIso(date.getFullYear(), date.getMonth() + 1, date.getDate());

export function addDays(iso: IsoDate, n: number): IsoDate {
  const p = parseIso(iso);
  if (!p) return iso;
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** 0 is Sunday. */
export const weekday = (iso: IsoDate) => {
  const p = parseIso(iso);
  return p ? new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() : 0;
};

/** Whole days from `today` to `iso`; negative in the past. */
export const daysUntil = daysFrom;

const yearSuffix = (year: number, today: IsoDate) => (year !== (parseIso(today)?.year ?? year) ? ` ${year}` : "");

/** "Wednesday 14 October", with the year when it isn't this year: "Saturday 20 March 2027". */
export function dateLong(iso: IsoDate, today: IsoDate): string {
  const p = parseIso(iso);
  return p ? `${DAY_NAMES[weekday(iso)]} ${p.day} ${MONTH_NAMES[p.month - 1]}${yearSuffix(p.year, today)}` : "";
}

/** "14 Oct", with the year when it isn't this year. */
export function dateShort(iso: IsoDate, today: IsoDate): string {
  const p = parseIso(iso);
  return p ? `${p.day} ${MONTH_NAMES[p.month - 1].slice(0, 3)}${yearSuffix(p.year, today)}` : "";
}

/** "October", or "March 2027". */
export const monthHeading = (year: number, month: number, today: IsoDate) =>
  `${MONTH_NAMES[month - 1]}${yearSuffix(year, today)}`;

/** "3 days late" · "due today" · "due tomorrow" · "due in 4 days" (up to 14) · "due Friday 30 October". */
export function dueText(iso: IsoDate, today: IsoDate): string {
  const n = daysUntil(iso, today);
  if (n < 0) return `${plural(-n, "day")} late`;
  if (n === 0) return "due today";
  if (n === 1) return "due tomorrow";
  if (n <= SOON) return `due in ${n} days`;
  return `due ${dateLong(iso, today)}`;
}

/** For sentences about the past: "was due Monday 12 October". */
export const wasDueText = (iso: IsoDate, today: IsoDate) => `was due ${dateLong(iso, today)}`;

/** An agenda day: "Today, Wednesday 14 October" · "Tomorrow, Thursday 15 October" · then the long date. */
export function dayTitle(iso: IsoDate, today: IsoDate): string {
  const n = daysUntil(iso, today);
  const long = dateLong(iso, today);
  return n === 0 ? `Today, ${long}` : n === 1 ? `Tomorrow, ${long}` : long;
}

export interface TimeGone {
  /** Days since the planner was set up. */
  elapsed: number;
  /** Days from then to the wedding. */
  total: number;
  /** Whole percent of that time that has passed, from 0 to 100. */
  percent: number;
}

/**
 * How much of the preparation time has gone, counted from the day the planner
 * was set up (guide §6.11). `null` until both dates are known.
 */
export function timeGone(startedOn: IsoDate | null, wedding: IsoDate | null, today: IsoDate): TimeGone | null {
  if (!isIsoDate(startedOn) || !isIsoDate(wedding)) return null;
  const total = daysUntil(wedding, startedOn);
  const elapsed = daysUntil(today, startedOn);
  const percent = total <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  return { elapsed, total, percent };
}

/**
 * When something was last edited: "just now" · "12 min ago" · "2 hours ago" ·
 * "yesterday" · then the short date, plus "by Bella" when it was the partner.
 * `at` and `now` are epoch milliseconds; a missing or future `at` (a write that
 * hasn't been stamped yet) reads as "just now". Days are counted in the local zone.
 */
export function editedText(at: number | null | undefined, now: number, by?: string | null): string {
  const who = by ? ` by ${by}` : "";
  if (at == null || !Number.isFinite(at)) return "just now" + who;
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return "just now" + who;
  if (minutes < 60) return `${minutes} min ago` + who;
  const then = new Date(at);
  const today = localIso(new Date(now));
  const day = localIso(then);
  if (day === today) {
    const hours = Math.floor(minutes / 60);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago` + who;
  }
  if (day === addDays(today, -1)) return "yesterday" + who;
  return dateShort(day, today) + who;
}
