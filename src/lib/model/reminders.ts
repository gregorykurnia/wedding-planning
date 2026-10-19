/**
 * Reminders that have come due (guide §6.12; S10, N11, implementation plan
 * §2.9, Task 6.2).
 *
 * Reminders go out once a day, in the morning (plan §9.2 Q8), so a reminder is
 * a morning, not a moment: "the morning before" (1440 stored minutes) is due on
 * the day before the event's day, "a week before" (10080) seven days before.
 * The daily run sends what is due today, and also what was due yesterday when
 * that run didn't happen ("any missed in the last 24 hours"), as long as the
 * event is still to come. A reminder stored for a time of day ("1 hour
 * before") can't arrive (N11) and is never sent; the schedule names it instead.
 * A reminder already in `remindersSent` is not sent again.
 *
 * `today` and `now` are the planner's own calendar day and clock time
 * (`plannerClock()`), passed in so everything here stays pure.
 */
import { eventTimes, type EventRecord } from "./agenda";
import type { IsoDate } from "./bookings";
import { addDays, dayTitle, isIsoDate } from "./dates";
import { REMINDERS } from "./schedule";

export interface DueReminder {
  event: EventRecord;
  /** Which of the event's reminders this is, as stored. */
  minutes: number;
  /** The morning it was meant for. Yesterday when the run that day was missed. */
  morning: IsoDate;
  /** The event's day. */
  date: IsoDate;
}

/**
 * Event times are stored as wall-clock times with no zone, as the two of you
 * typed them. The server runs in UTC, so it reads the day and time in the
 * planner's zone: Jakarta. The run at 00:00 UTC is 07:00 there and 08:00 in
 * Bali, the same calendar day in both.
 */
export const PLANNER_TIME_ZONE = "Asia/Jakarta";

/** The planner's calendar day and `HH:MM` clock time at `at`. */
export function plannerClock(at: Date, timeZone: string = PLANNER_TIME_ZONE): { today: IsoDate; now: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { today: `${parts.year}-${parts.month}-${parts.day}` as IsoDate, now: `${parts.hour}:${parts.minute}` };
}

/** How many mornings ahead a stored reminder is; `null` for one that can't arrive. */
const aheadOf = (minutes: number): number | null => REMINDERS.find((r) => r.minutes === minutes && r.ahead)?.ahead ?? null;

/** Still of use: an event on a later day, or later today (all day counts until midnight). */
function stillToCome(date: IsoDate, start: string | null, today: IsoDate, now: string): boolean {
  if (date !== today) return date > today;
  return start === null || start > now;
}

/**
 * The reminders due on the morning of `today` (and any left from yesterday's
 * missed run) that haven't been sent, soonest event first. `now` is `HH:MM`.
 */
export function remindersDue(events: readonly EventRecord[], today: IsoDate, now: string): DueReminder[] {
  const out: DueReminder[] = [];
  const yesterday = addDays(today, -1);
  for (const event of events) {
    if (event.status !== "scheduled") continue;
    const t = eventTimes(event);
    if (!t.date || !isIsoDate(t.date) || !stillToCome(t.date, t.start, today, now)) continue;
    const sent = new Set(event.remindersSent ?? []);
    for (const minutes of new Set(event.reminderMinutes)) {
      const ahead = aheadOf(minutes);
      if (ahead === null || sent.has(minutes)) continue;
      const morning = addDays(t.date, -ahead);
      if (morning === today || morning === yesterday) out.push({ event, minutes, morning, date: t.date });
    }
  }
  const startOf = (r: DueReminder) => `${r.date}T${eventTimes(r.event).start ?? "00:00"}`;
  return out.sort((a, z) => startOf(a).localeCompare(startOf(z)) || a.event.title.localeCompare(z.event.title) || a.minutes - z.minutes);
}

/** What a reminder shows: { title, body, url, tag }, as the service worker reads it (`public/sw.js`). */
export interface ReminderPush {
  title: string;
  body: string;
  /** The event's address, which opens its sheet. */
  url: string;
  /** One notification per event and reminder, so a repeat replaces rather than stacks. */
  tag: string;
}

/**
 * The notification for a due reminder (provisional wording, §9.1 G33): the
 * event's title, then its day and time ("Tomorrow, Thursday 15 October, 11:00")
 * and where, when it's a place rather than a call link.
 */
export function reminderPush(r: DueReminder, today: IsoDate, eventHref: (id: string) => string): ReminderPush {
  const t = eventTimes(r.event);
  const when = `${dayTitle(r.date, today)}, ${t.start ?? "all day"}`;
  const where = r.event.location.trim();
  const place = where && !/^https?:\/\//i.test(where) ? where : "";
  return {
    title: r.event.title.trim() || "Something in the schedule",
    body: place ? `${when}\n${place}` : when,
    url: eventHref(r.event.id),
    tag: `reminder-${r.event.id}-${r.minutes}`,
  };
}

/** What "Send a test reminder" sends (provisional wording, §9.1 G33). */
export const TEST_PUSH = {
  title: "Test reminder",
  body: "Reminders from the planner arrive like this, in the morning.",
  tag: "test-reminder",
} as const;
