/**
 * The agenda and the month (guide §4.25, §4.26, §5.19, §5.20; S3–S6, O2).
 *
 * One line of time made from three sources: our own events, payments due on
 * bookings, and open tasks with a due date. Late means still scheduled and
 * dated before today. "Today" is always the real today that's passed in, never
 * the first of whatever month is on screen (inventory-notes §5 #11).
 */
import type { IsoDate } from "./bookings";
import { addDays, dateLong, daysInMonth, dayTitle, isIsoDate, toIso, weekday } from "./dates";
import { plural } from "./format";
import type { ScheduleKind } from "./labels";
import { SCHEDULE_KINDS } from "./labels";
import { SOON, type Due } from "./money";
import { matches } from "./search";
import { stepsDone, type StepsDone, type TaskRecord } from "./tasks";

export type EventStatus = "scheduled" | "completed" | "cancelled";

/** A stored schedule event. */
export interface EventRecord {
  id: string;
  title: string;
  /** A stored kind; a value this version doesn't know is treated as "other". */
  type: string;
  /** `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` in local time. */
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  notes: string;
  location: string;
  status: EventStatus;
  relatedVendorId: string | null;
  relatedVenueId: string | null;
  /** Minutes before the start, as stored. */
  reminderMinutes: number[];
  /** The `reminderMinutes` values already sent (`reminders.ts`). */
  remindersSent?: number[];
}

const TIME = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})$/;

const timeOf = (value: string | null | undefined) => {
  const m = TIME.exec(value ?? "");
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1]}:${m[2]}` : null;
};

export interface EventTimes {
  /** `null` when the stored start isn't a real date; such an event can't be placed on the agenda. */
  date: IsoDate | null;
  /** 24-hour "10:00"; `null` for all-day events. */
  start: string | null;
  end: string | null;
  allDay: boolean;
}

export function eventTimes(e: Pick<EventRecord, "startAt" | "endAt" | "allDay">): EventTimes {
  const date = e.startAt.slice(0, 10);
  const start = e.allDay ? null : timeOf(e.startAt);
  return {
    date: isIsoDate(date) ? date : null,
    start,
    end: start ? timeOf(e.endAt) : null,
    allDay: start === null,
  };
}

export type AgendaKind = ScheduleKind | "task";
export type AgendaType = "event" | "payment" | "task";

export interface AgendaItem {
  /** Unique across the three sources. */
  key: string;
  type: AgendaType;
  /** The record behind it: an event or task id, or a booking id for a payment. */
  id: string;
  kind: AgendaKind;
  date: IsoDate;
  start: string | null;
  end: string | null;
  title: string;
  /** An event's place or call link. */
  where: string;
  notes: string;
  status: EventStatus;
  /** The vendor or venue an event is about. */
  relatedId: string | null;
  /** Payments: what's left to pay, who pays, and which part. */
  amount: number | null;
  funder: string | null;
  partId: string | null;
  /** Tasks: how many steps are done. */
  steps: StepsDone | null;
}

const KNOWN_KINDS = new Set<string>(SCHEDULE_KINDS.map((k) => k.value));

const base = (item: Pick<AgendaItem, "key" | "type" | "id" | "kind" | "date" | "title" | "status">): AgendaItem => ({
  start: null,
  end: null,
  where: "",
  notes: "",
  relatedId: null,
  amount: null,
  funder: null,
  partId: null,
  steps: null,
  ...item,
});

/** Late means still scheduled and dated before `today`. It isn't stored on the item, so a screen left open overnight stays right (§5 #13). */
export const isLate = (i: Pick<AgendaItem, "status" | "date">, today: IsoDate) => i.status === "scheduled" && i.date < today;

/**
 * Events, payments due and dated open tasks as one list, by date. On a day,
 * things without a time come first, then timed ones by start. The payments are
 * `dues()` from the money model.
 */
export function agendaItems(events: readonly EventRecord[], dues: readonly Due[], tasks: readonly TaskRecord[]): AgendaItem[] {
  const out: AgendaItem[] = [];

  for (const e of events) {
    const t = eventTimes(e);
    if (!t.date) continue;
    out.push({
      ...base(
        {
          key: `event:${e.id}`,
          type: "event",
          id: e.id,
          kind: (KNOWN_KINDS.has(e.type) ? e.type : "other") as ScheduleKind,
          date: t.date,
          title: e.title,
          status: e.status,
        },
      ),
      start: t.start,
      end: t.end,
      where: e.location,
      notes: e.notes,
      relatedId: e.relatedVendorId ?? e.relatedVenueId ?? null,
    });
  }

  for (const d of dues) {
    const inParts = d.booking.parts.length > 0;
    out.push({
      ...base(
        {
          key: `payment:${d.booking.id}:${d.part.id ?? ""}`,
          type: "payment",
          id: d.booking.id,
          kind: "payment",
          date: d.due,
          title: inParts ? `${d.booking.name}, ${d.part.name.toLowerCase()}` : d.booking.name,
          status: "scheduled",
        },
      ),
      amount: d.left,
      funder: d.funder,
      partId: d.part.id,
    });
  }

  for (const t of tasks) {
    if (t.done || !isIsoDate(t.dueDate)) continue;
    out.push({
      ...base({ key: `task:${t.id}`, type: "task", id: t.id, kind: "task", date: t.dueDate, title: t.title, status: "scheduled" }),
      notes: t.notes,
      steps: t.subtasks.length ? stepsDone(t) : null,
    });
  }

  const rank = (i: AgendaItem) => (i.start ? 1 : 0);
  return out
    .map((item, index) => ({ item, index }))
    .sort(
      (a, z) =>
        a.item.date.localeCompare(z.item.date) ||
        rank(a.item) - rank(z.item) ||
        (a.item.start ?? "").localeCompare(z.item.start ?? "") ||
        a.index - z.index,
    )
    .map((x) => x.item);
}

export type AgendaFilterKey = "all" | "payment" | "task" | "call" | "appointment" | "deadline" | "own" | "other";

export const AGENDA_FILTERS: { key: AgendaFilterKey; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "payment", label: "Payments" },
  { key: "task", label: "Tasks" },
  { key: "call", label: "Calls" },
  { key: "appointment", label: "Appointments" },
  { key: "deadline", label: "Deadlines" },
  { key: "own", label: "Our events" },
  { key: "other", label: "Other" },
];

export interface AgendaFilter {
  kind: AgendaFilterKey;
  query: string;
  /** Show completed and cancelled things too. */
  showDone: boolean;
}

export const NO_AGENDA_FILTER: AgendaFilter = { kind: "all", query: "", showDone: false };

export const isFilteringAgenda = (f: AgendaFilter) => f.kind !== "all" || !!f.query.trim();

const kindMatches = (i: AgendaItem, kind: AgendaFilterKey) => {
  switch (kind) {
    case "all":
      return true;
    case "own":
      return i.type === "event";
    case "call":
      return i.kind === "vendor_call" || i.kind === "organiser_call";
    // Payments are the ones due on bookings and our own events of the kind Payment.
    case "payment":
      return i.type === "payment" || i.kind === "payment";
    case "task":
      return i.type === "task";
    default:
      return i.kind === kind;
  }
};

/** Titles, places and notes. Completed and cancelled things stay out of sight unless asked for. */
export const filterAgenda = (items: readonly AgendaItem[], f: AgendaFilter): AgendaItem[] =>
  items.filter(
    (i) => (f.showDone || i.status === "scheduled") && kindMatches(i, f.kind) && matches(f.query, i.title, i.where, i.notes),
  );

export interface AgendaGroup {
  /** "late", or the day. */
  key: "late" | IsoDate;
  title: string;
  late: boolean;
  today: boolean;
  /** How many things are in the group, before paging. */
  count: number;
  items: AgendaItem[];
}

/** "Late" first, then each day with something on it, in date order. */
export function agendaGroups(items: readonly AgendaItem[], today: IsoDate): AgendaGroup[] {
  const groups: AgendaGroup[] = [];
  const late = items.filter((i) => isLate(i, today));
  if (late.length) groups.push({ key: "late", title: "Late", late: true, today: false, count: late.length, items: late });
  const byDay = new Map<IsoDate, AgendaItem[]>();
  for (const i of items) if (!isLate(i, today)) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);
  for (const date of [...byDay.keys()].sort()) {
    const list = byDay.get(date) ?? [];
    groups.push({ key: date, title: dayTitle(date, today), late: false, today: date === today, count: list.length, items: list });
  }
  return groups;
}

/** Keeps the first `shown` things across the groups ("Show 80 more"); a group's `count` stays the full size. */
export function pageGroups(groups: readonly AgendaGroup[], shown: number): AgendaGroup[] {
  let budget = shown;
  const out: AgendaGroup[] = [];
  for (const g of groups) {
    if (budget <= 0) break;
    out.push({ ...g, items: g.items.slice(0, budget) });
    budget -= g.items.length;
  }
  return out;
}

export interface ContextPart {
  text: string;
  emphasis?: "late" | "strong";
}

export interface LateOrToday {
  /** Anything scheduled at all. */
  has: boolean;
  late: number;
  today: number;
  tomorrow: number;
  /** Things two to 14 days away. */
  soon: number;
  /** The big number: late plus today, or tomorrow's when there are none. */
  figure: number;
  kicker: string;
  /** The sentence under the figure; the screen sets late and strong pieces apart. */
  context: ContextPart[];
}

/** The figure and sentence at the top of the Schedule (S6). Looks at everything scheduled, whatever the filters. */
export function lateOrToday(items: readonly AgendaItem[], today: IsoDate): LateOrToday {
  const open = items.filter((i) => i.status === "scheduled");
  const tomorrowDate = addDays(today, 1);
  const late = open.filter((i) => isLate(i, today)).length;
  const now = open.filter((i) => i.date === today).length;
  const tomorrow = open.filter((i) => i.date === tomorrowDate).length;
  const soon = open.filter((i) => i.date > tomorrowDate && i.date <= addDays(today, SOON)).length;
  const n = late + now;

  const context: ContextPart[] = [];
  if (n) {
    if (late) context.push({ text: `${late} late`, emphasis: "late" });
    if (late && now) context.push({ text: " and " });
    if (now) context.push({ text: `${now} today`, emphasis: "strong" });
    context.push({ text: (tomorrow ? `, then ${tomorrow} tomorrow` : "") + "." });
  } else if (tomorrow) {
    context.push({ text: `${plural(tomorrow, "thing")} tomorrow.` });
  }
  if (soon) context.push({ text: `${context.length ? " " : ""}${plural(soon, "more thing")} in the next ${SOON} days.` });

  return {
    has: open.length > 0,
    late,
    today: now,
    tomorrow,
    soon,
    figure: n || tomorrow,
    kicker: n ? "Late or due today" : tomorrow ? "Nothing late or due today. Tomorrow:" : "Nothing late or due today",
    context,
  };
}

export const contextText = (parts: readonly ContextPart[]) => parts.map((p) => p.text).join("");

/** What's coming up on the Overview: the first few things still scheduled, late ones first. */
export const comingUp = (items: readonly AgendaItem[], limit = 5): AgendaItem[] =>
  items.filter((i) => i.status === "scheduled").slice(0, limit);

export type DotKind = "late" | "event" | "payment" | "task";

export interface MonthCell {
  /** `null` for the blank cells before the 1st. */
  date: IsoDate | null;
  day: number;
  today: boolean;
  selected: boolean;
  wedding: boolean;
  /** Up to three marks. */
  dots: DotKind[];
  /** Things past the three marks (the "+2"). */
  more: number;
  /** Says everything the marks show. */
  label: string;
}

const dotOf = (i: AgendaItem, today: IsoDate): DotKind => (isLate(i, today) ? "late" : i.type);

export interface MonthInput {
  year: number;
  month: number;
  /** What the marks show: pass what the filters let through. */
  items: readonly AgendaItem[];
  today: IsoDate;
  selected: IsoDate | null;
  wedding: IsoDate | null;
}

/** The things on one day. */
export const itemsOn = (items: readonly AgendaItem[], date: IsoDate) => items.filter((i) => i.date === date);

/** Cells for a Monday-first grid: blanks before the 1st, then each day of the month. */
export function monthCells({ year, month, items, today, selected, wedding }: MonthInput): MonthCell[] {
  const byDay = new Map<IsoDate, AgendaItem[]>();
  for (const i of items) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);

  const cells: MonthCell[] = [];
  const lead = (weekday(toIso(year, month, 1)) + 6) % 7;
  for (let k = 0; k < lead; k++) {
    cells.push({ date: null, day: 0, today: false, selected: false, wedding: false, dots: [], more: 0, label: "" });
  }

  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const date = toIso(year, month, day);
    const list = byDay.get(date) ?? [];
    const isToday = date === today;
    const isSelected = date === selected;
    const isWedding = date === wedding;
    const counts: [DotKind, number][] = (["late", "payment", "task", "event"] as const).map((k) => [k, list.filter((i) => dotOf(i, today) === k).length]);
    const kinds = counts
      .filter(([, c]) => c)
      .map(([k, c]) => (k === "late" ? `${c} late` : plural(c, k)));
    cells.push({
      date,
      day,
      today: isToday,
      selected: isSelected,
      wedding: isWedding,
      dots: list.slice(0, 3).map((i) => dotOf(i, today)),
      more: Math.max(0, list.length - 3),
      label: [
        dateLong(date, today),
        isToday ? "today" : "",
        isWedding ? "the wedding day" : "",
        isSelected ? "selected" : "",
        kinds.length ? kinds.join(", ") : "nothing",
      ]
        .filter(Boolean)
        .join(", "),
    });
  }
  return cells;
}
