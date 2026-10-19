/**
 * The Schedule's event sheet: what is stored, what a reminder can mean, and what
 * an event needs (guide §5.19, §6.12; S1, S2, S10, N9, N11).
 *
 * Reminders go out once a day, in the morning (plan §9.2 Q8), so only "the
 * morning before" (1440 minutes) and "a week before" (10080) can arrive. A
 * reminder stored before that rule for a time of day ("1 hour before") is named,
 * never switched silently. Dates are passed in as `YYYY-MM-DD` so everything
 * here stays pure.
 */
import { eventTimes, type EventRecord } from "./agenda";
import type { IsoDate } from "./bookings";
import { dateLong, daysUntil, isIsoDate } from "./dates";
import { SCHEDULE_KINDS, type ScheduleKind } from "./labels";

// ---------- reminders (N11) ----------

export type ReminderKey = "" | "1d" | "7d";

export interface ReminderChoice {
  key: ReminderKey;
  label: string;
  /** Minutes before the start, as stored; `null` is no reminder. */
  minutes: number | null;
  /** How many mornings ahead; the choice needs that morning to still be to come. */
  ahead: number;
}

export const REMINDERS: readonly ReminderChoice[] = [
  { key: "", label: "No reminder", minutes: null, ahead: 0 },
  { key: "1d", label: "The morning before", minutes: 1440, ahead: 1 },
  { key: "7d", label: "A week before, in the morning", minutes: 10080, ahead: 7 },
];

/** What a reminder set before the once-a-day rule was called. */
const OLD_LABELS: Record<number, string> = { 0: "When it starts", 15: "15 minutes before", 60: "1 hour before" };

export type ReminderState =
  | { kind: "choice"; key: ReminderKey }
  /** Set for a time of day: it can't arrive, and nothing changes it until we choose again. */
  | { kind: "old"; minutes: number; label: string };

/** A stored `reminderMinutes` array shows as one choice, from its first value. */
export function reminderState(minutes: readonly number[] | null | undefined): ReminderState {
  const first = minutes?.[0];
  if (first === undefined || first === null) return { kind: "choice", key: "" };
  const found = REMINDERS.find((r) => r.minutes === first);
  if (found) return { kind: "choice", key: found.key };
  return { kind: "old", minutes: first, label: OLD_LABELS[first] ?? `${first} minutes before` };
}

/** The stored value for a choice: no reminder is an empty list. */
export const reminderMinutesOf = (key: ReminderKey): number[] => {
  const minutes = REMINDERS.find((r) => r.key === key)?.minutes;
  return minutes == null ? [] : [minutes];
};

/** The morning has already gone: an event tomorrow can't have "the morning before". */
export function reminderPast(key: ReminderKey, date: IsoDate | null, today: IsoDate): boolean {
  const ahead = REMINDERS.find((r) => r.key === key)?.ahead ?? 0;
  if (!ahead || !date) return false;
  return daysUntil(date, today) - ahead < 1;
}

export interface ReminderOption {
  value: ReminderKey;
  label: string;
  disabled: boolean;
}

/** The choices for an event on `date`: a morning that has gone is greyed with its reason. */
export function reminderOptions(date: IsoDate | null, today: IsoDate): ReminderOption[] {
  return REMINDERS.map((r) => {
    const past = reminderPast(r.key, date, today);
    return { value: r.key, label: r.label + (past ? " (that morning has gone)" : ""), disabled: past };
  });
}

/** The choice a new event starts with: the morning before, unless that morning has gone. */
export const defaultReminder = (date: IsoDate | null, today: IsoDate): ReminderKey =>
  reminderPast("1d", date, today) ? "" : "1d";

/** A scheduled event, still to come, whose reminder was set for a time of day. */
export function reminderCantArrive(event: Pick<EventRecord, "status" | "reminderMinutes" | "startAt">, today: IsoDate): boolean {
  if (event.status !== "scheduled" || reminderState(event.reminderMinutes).kind !== "old") return false;
  const { date } = eventTimes({ startAt: event.startAt, endAt: null, allDay: false });
  return date !== null && date >= today;
}

/** What the sheet says under Remind us for a reminder that can't arrive. */
export function oldReminderLine(label: string, date: IsoDate | null, today: IsoDate): string {
  const open = REMINDERS.filter((r) => r.key && !reminderPast(r.key, date, today)).map((r) =>
    r.key === "1d" ? "the morning before" : "a week before",
  );
  return (
    `You chose “${label.toLowerCase()}” when you set this up. That can’t arrive: reminders come once a day, in the morning. ` +
    (open.length ? `Choose ${open.join(", ")} or no reminder.` : "Its mornings have gone, so choose no reminder.")
  );
}

export const REMINDER_HINT = "Reminders come once a day, in the morning.";

// ---------- what the sheet edits ----------

/** The four values an event's time is made of. A blank time is "". */
export interface WhenDraft {
  /** `YYYY-MM-DD`, or "" when none is chosen. */
  date: string;
  allDay: boolean;
  /** "10:00", or "". */
  start: string;
  end: string;
}

/** What a stored event reads as in the sheet: a date-only event is all day. */
export function whenOf(event: Pick<EventRecord, "startAt" | "endAt" | "allDay">): WhenDraft {
  const t = eventTimes(event);
  return { date: t.date ?? "", allDay: t.allDay, start: t.start ?? "", end: t.end ?? "" };
}

/**
 * The stored start, end and all-day flag for a time. A date alone, or all day,
 * is stored as the date; a start adds its time. An end only counts with a
 * start, on the same day, and never before it: a stored event never ends before
 * it starts, even while the sheet still shows the end that was typed.
 */
export function storedWhen(when: WhenDraft): { startAt: string; endAt: string | null; allDay: boolean } {
  const timed = !when.allDay && when.start !== "";
  return {
    startAt: timed ? `${when.date}T${when.start}` : when.date,
    endAt: timed && when.end !== "" && when.end >= when.start ? `${when.date}T${when.end}` : null,
    allDay: when.allDay,
  };
}

/**
 * What a change to an event's time writes. Reminders are mornings (§6.12), so
 * only a new day clears what was already sent; a new start or end on the same
 * day keeps it, and the morning-before reminder isn't sent twice (P4-S17).
 */
export function whenPatch(before: WhenDraft, next: WhenDraft): Record<string, unknown> {
  const stored = storedWhen(next);
  return before.date === next.date ? stored : { ...stored, remindersSent: [] };
}

/** Switching a timed event on again starts it at 10:00 (the sheet's default). */
export const DEFAULT_START = "10:00";

export type EventField = "title" | "date" | "end";

/** The three things an event must have (N9): a title, a date, and an end that isn't before the start. */
export function eventProblems(draft: { title: string; date: string } & Pick<WhenDraft, "allDay" | "start" | "end">): EventField[] {
  const out: EventField[] = [];
  if (!draft.title.trim()) out.push("title");
  if (!isIsoDate(draft.date)) out.push("date");
  if (!draft.allDay && draft.start && draft.end && draft.end < draft.start) out.push("end");
  return out;
}

/** The one line that says what to do (guide §6.1). `kept` is what the schedule still holds, for an event that exists. */
export function needLine(field: EventField, kept: { title: string; date: string } | null, today: IsoDate): string {
  switch (field) {
    case "title":
      return kept?.title.trim()
        ? `It needs a title. The schedule keeps “${kept.title.trim()}” until you give it one.`
        : "Give it a title so you can find it in the schedule.";
    case "date":
      return isIsoDate(kept?.date)
        ? `It needs a date. The schedule keeps it on ${dateLong(kept.date, today)} until you choose one.`
        : "Choose the day it happens.";
    case "end":
      return "It ends before it starts. Change the end time, or leave it empty.";
  }
}

const HELD_NAMES: Record<EventField, string> = { title: "the title", date: "the date", end: "the end time" };

/** The save line while a change can't be saved yet: "1 change not saved yet: the end time". */
export function heldLine(fields: readonly EventField[]): string {
  const n = fields.length;
  return `${n === 1 ? "1 change" : `${n} changes`} not saved yet: ${fields.map((f) => HELD_NAMES[f]).join(" and ")}`;
}

/** Stored kinds this version knows; anything else is shown as Other. */
export const kindOf = (type: string): ScheduleKind =>
  SCHEDULE_KINDS.some((k) => k.value === type) ? (type as ScheduleKind) : "other";

/** The two stored links for a "With" value: "", "vendor:<id>" or "venue:<id>". */
export function relatedFields(related: string): { relatedVendorId: string | null; relatedVenueId: string | null } {
  const [kind, id] = related.split(":");
  return {
    relatedVendorId: kind === "vendor" && id ? id : null,
    relatedVenueId: kind === "venue" && id ? id : null,
  };
}

/** The fields stored for an event, from the sheet's values. `related` is "", "vendor:<id>" or "venue:<id>". */
export function storedEvent(input: {
  title: string;
  kind: ScheduleKind;
  when: WhenDraft;
  related: string;
  where: string;
  notes: string;
  remind: ReminderKey;
}) {
  return {
    title: input.title.trim(),
    type: input.kind,
    ...storedWhen(input.when),
    location: input.where.trim(),
    notes: input.notes,
    ...relatedFields(input.related),
    reminderMinutes: reminderMinutesOf(input.remind),
  };
}

/** The sheet's "With" value for a stored event. */
export const relatedValue = (e: Pick<EventRecord, "relatedVendorId" | "relatedVenueId">): string =>
  e.relatedVendorId ? `vendor:${e.relatedVendorId}` : e.relatedVenueId ? `venue:${e.relatedVenueId}` : "";
