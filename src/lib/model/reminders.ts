/**
 * Reminders that have come due (guide §6.12; S10, implementation plan §2.9).
 *
 * An event can carry reminders as minutes before its start. One is due once
 * its moment has come, while it can still be of use: before a timed event
 * starts, or any time on the day of an all-day event. A reminder already in
 * `remindersSent` is not sent again. Times are in the local zone; `now` is
 * epoch milliseconds, passed in.
 */
import { eventTimes, type EventRecord } from "./agenda";
import { parseIso } from "./dates";

export interface DueReminder {
  event: EventRecord;
  /** Which of the event's reminders this is. */
  minutes: number;
  /** When it was due, epoch milliseconds. */
  at: number;
  /** When the event starts (midnight for all-day events), epoch milliseconds. */
  startsAt: number;
}

/** Local midnight at the start of the event's day, plus its start time when it has one. */
function startOf(event: EventRecord): { startsAt: number; endOfUse: number } | null {
  const t = eventTimes(event);
  const p = parseIso(t.date);
  if (!t.date || !p) return null;
  const [hour, minute] = t.start ? t.start.split(":").map(Number) : [0, 0];
  const startsAt = new Date(p.year, p.month - 1, p.day, hour, minute).getTime();
  const endOfDay = new Date(p.year, p.month - 1, p.day + 1).getTime();
  return { startsAt, endOfUse: t.start ? startsAt : endOfDay };
}

/** The reminders that are due at `now` and haven't been sent, earliest first. */
export function remindersDue(events: readonly EventRecord[], now: number): DueReminder[] {
  const out: DueReminder[] = [];
  for (const event of events) {
    if (event.status !== "scheduled") continue;
    const when = startOf(event);
    if (!when || now >= when.endOfUse) continue;
    const sent = new Set(event.remindersSent ?? []);
    for (const minutes of new Set(event.reminderMinutes)) {
      if (!Number.isFinite(minutes) || minutes < 0 || sent.has(minutes)) continue;
      const at = when.startsAt - minutes * 60_000;
      if (at <= now) out.push({ event, minutes, at, startsAt: when.startsAt });
    }
  }
  return out.sort((a, z) => a.at - z.at || a.event.title.localeCompare(z.event.title));
}
