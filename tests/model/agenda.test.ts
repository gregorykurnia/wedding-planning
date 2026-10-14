import { describe, expect, it } from "vitest";
import {
  AGENDA_FILTERS,
  NO_AGENDA_FILTER,
  agendaGroups,
  agendaItems,
  comingUp,
  contextText,
  eventTimes,
  filterAgenda,
  isLate,
  isFilteringAgenda,
  itemsOn,
  lateOrToday,
  monthCells,
  pageGroups,
  type AgendaItem,
  type EventRecord,
} from "@/lib/model/agenda";
import { bookingsFrom, type PartRecord, type VendorRecord } from "@/lib/model/bookings";
import { dues } from "@/lib/model/money";
import type { TaskRecord } from "@/lib/model/tasks";

const TODAY = "2026-10-14";

const event = (over: Partial<EventRecord> = {}): EventRecord => ({
  id: "e",
  title: "Event",
  type: "appointment",
  startAt: "2026-10-16T11:00",
  endAt: null,
  allDay: false,
  notes: "",
  location: "",
  status: "scheduled",
  relatedVendorId: null,
  relatedVenueId: null,
  reminderMinutes: [],
  ...over,
});

const task = (over: Partial<TaskRecord> = {}): TaskRecord => ({
  id: "t",
  title: "Task",
  notes: "",
  dueDate: "2026-10-25",
  done: false,
  subtasks: [],
  ...over,
});

const vendor = (over: Partial<VendorRecord> = {}): VendorRecord => ({
  id: "v1",
  name: "Dapur Lestari Catering",
  category: "Food",
  contractStatus: "Chosen",
  funder: "Gregory",
  totalPrice: 100_000_000,
  budgetSpent: 40_000_000,
  nextTargetDate: "2026-10-20",
  nextAction: "",
  subEntries: [],
  ...over,
});

const part = (over: Partial<PartRecord> = {}): PartRecord => ({
  id: "p1",
  name: "Final Payment",
  totalPrice: 60_000_000,
  budgetSpent: 0,
  nextTargetDate: "2026-11-05",
  nextAction: "",
  ...over,
});

const dueList = (vendors: VendorRecord[]) => dues(bookingsFrom(vendors, []), TODAY);
const build = (events: EventRecord[] = [], vs: VendorRecord[] = [], tasks: TaskRecord[] = []) => agendaItems(events, dueList(vs), tasks);

describe("eventTimes", () => {
  it("reads a date and 24-hour times", () => {
    expect(eventTimes(event({ startAt: "2026-10-16T11:00", endAt: "2026-10-16T12:30" }))).toEqual({
      date: "2026-10-16",
      start: "11:00",
      end: "12:30",
      allDay: false,
    });
  });

  it("reads all-day events, with or without stray times", () => {
    expect(eventTimes(event({ startAt: "2026-11-28", endAt: null, allDay: true }))).toEqual({ date: "2026-11-28", start: null, end: null, allDay: true });
    expect(eventTimes(event({ startAt: "2026-11-28T09:00", endAt: "2026-11-28T10:00", allDay: true }))).toEqual({
      date: "2026-11-28",
      start: null,
      end: null,
      allDay: true,
    });
  });

  it("treats a date with no time as all day, and gives no end to an untimed event", () => {
    expect(eventTimes(event({ startAt: "2026-11-28", allDay: false }))).toMatchObject({ start: null, allDay: true });
    expect(eventTimes(event({ startAt: "2026-11-28", endAt: "2026-11-28T10:00", allDay: false })).end).toBeNull();
  });

  it("rejects a date that isn't real", () => {
    expect(eventTimes(event({ startAt: "2026-02-30T10:00" })).date).toBeNull();
    expect(eventTimes(event({ startAt: "garbage" })).date).toBeNull();
    expect(eventTimes(event({ startAt: "2026-10-16T25:00" }))).toMatchObject({ date: "2026-10-16", start: null });
  });
});

describe("agendaItems", () => {
  it("merges events, payments due and dated open tasks, by date", () => {
    const items = build(
      [event({ id: "e1", title: "Tasting", startAt: "2026-10-16T11:00" }), event({ id: "e2", title: "Pre-wedding shoot", startAt: "2026-11-28", allDay: true })],
      [vendor()],
      [task({ id: "t1", title: "Finalise the guest list", dueDate: "2026-10-25" })],
    );
    expect(items.map((i) => [i.type, i.date])).toEqual([
      ["event", "2026-10-16"],
      ["payment", "2026-10-20"],
      ["task", "2026-10-25"],
      ["event", "2026-11-28"],
    ]);
  });

  it("puts untimed things before timed ones on a day, then orders by start", () => {
    const items = build(
      [
        event({ id: "late", title: "Late", startAt: "2026-10-20T16:00" }),
        event({ id: "early", title: "Early", startAt: "2026-10-20T08:30" }),
        event({ id: "allday", title: "All day", startAt: "2026-10-20", allDay: true }),
      ],
      [vendor()],
      [task({ id: "t1", dueDate: "2026-10-20" })],
    );
    expect(items.map((i) => i.id)).toEqual(["allday", "vendor-v1", "t1", "early", "late"]);
  });

  it("builds payment rows from parts, with the part's own name, amount and funder", () => {
    const items = build([], [vendor({ subEntries: [part(), part({ id: "p2", name: "Deposit", totalPrice: 40_000_000, budgetSpent: 40_000_000 })] })]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: "payment",
      kind: "payment",
      id: "vendor-v1",
      partId: "p1",
      title: "Dapur Lestari Catering, final payment",
      date: "2026-11-05",
      amount: 60_000_000,
      status: "scheduled",
    });
  });

  it("builds a payment row for a booking with no parts under the booking's name", () => {
    const [i] = build([], [vendor()]);
    expect(i).toMatchObject({ title: "Dapur Lestari Catering", partId: null, amount: 60_000_000, funder: "Gregory", date: "2026-10-20" });
    expect(i.key).toBe("payment:vendor-v1:");
  });

  it("leaves out paid and undated payments, and finished or undated tasks", () => {
    const items = build(
      [],
      [vendor({ budgetSpent: 100_000_000 }), vendor({ id: "v2", nextTargetDate: null })],
      [task({ id: "done", done: true }), task({ id: "undated", dueDate: null }), task({ id: "bad", dueDate: "2026-02-30" })],
    );
    expect(items).toEqual([]);
  });

  it("works out late from the day it's asked on, so a screen left open overnight stays right (§5 #13)", () => {
    const [i] = build([event({ startAt: "2026-10-14T09:00" })]);
    expect(isLate(i, "2026-10-14")).toBe(false);
    expect(isLate(i, "2026-10-15")).toBe(true);
  });

  it("marks late what is scheduled and dated before today, and nothing else", () => {
    const items = build(
      [
        event({ id: "past", startAt: "2026-10-13", allDay: true }),
        event({ id: "now", startAt: "2026-10-14T09:00" }),
        event({ id: "done", startAt: "2026-10-10T10:00", status: "completed" }),
        event({ id: "off", startAt: "2026-10-08T16:00", status: "cancelled" }),
      ],
      [vendor({ nextTargetDate: "2026-10-01" })],
      [task({ id: "tl", dueDate: "2026-10-12" }), task({ id: "tn", dueDate: "2026-10-14" })],
    );
    const late = Object.fromEntries(items.map((i) => [i.id, isLate(i, TODAY)]));
    expect(late).toMatchObject({ past: true, now: false, done: false, off: false, "vendor-v1": true, tl: true, tn: false });
  });

  it("gives tasks their steps, and events their place, notes and related vendor", () => {
    const items = build(
      [event({ id: "e1", location: "https://meet.google.com/x", notes: "Bring both mums", relatedVendorId: "kebun", relatedVenueId: "samaya" })],
      [],
      [task({ id: "t1", subtasks: [{ id: "s1", title: "A", dueDate: null, done: true }, { id: "s2", title: "B", dueDate: null, done: false }] })],
    );
    expect(items.find((i) => i.id === "e1")).toMatchObject({ where: "https://meet.google.com/x", notes: "Bring both mums", relatedId: "kebun" });
    expect(items.find((i) => i.id === "t1")?.steps).toEqual({ done: 1, total: 2, percent: 50 });
    expect(items.find((i) => i.id === "e1")?.steps).toBeNull();
  });

  it("reads a vendor-less venue link, and a kind this version doesn't know as other", () => {
    const [a, b] = build([event({ id: "a", relatedVendorId: null, relatedVenueId: "samaya", type: "vendor_call" }), event({ id: "b", type: "mystery", startAt: "2026-10-17T10:00" })]);
    expect(a.relatedId).toBe("samaya");
    expect(a.kind).toBe("vendor_call");
    expect(b.kind).toBe("other");
  });

  it("skips an event whose date isn't real", () => {
    expect(build([event({ startAt: "2026-02-30T10:00" })])).toEqual([]);
  });

  it("keeps keys unique across the three sources", () => {
    const items = build([event({ id: "same" })], [vendor()], [task({ id: "same" })]);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });
});

describe("filterAgenda", () => {
  const items = build(
    [
      event({ id: "call", title: "Call with Laras about the arch", type: "vendor_call", startAt: "2026-10-14T15:00", location: "https://meet.google.com/arch" }),
      event({ id: "org", title: "Organiser check-in", type: "organiser_call", startAt: "2026-10-20T19:00" }),
      event({ id: "tasting", title: "Tasting at Sendok Emas", type: "appointment", startAt: "2026-10-16T11:00", location: "Jl. Raya Kerobokan 88", notes: "Bring both mums" }),
      event({ id: "hold", title: "Hold on our date ends", type: "deadline", startAt: "2026-10-31", allDay: true }),
      event({ id: "pay", title: "Pay the photographer", type: "payment", startAt: "2026-10-22", allDay: true }),
      event({ id: "misc", title: "Marriage course", type: "other", startAt: "2026-11-07T09:00" }),
      event({ id: "old", title: "Venue walkthrough", type: "appointment", startAt: "2026-10-10T10:00", status: "completed" }),
      event({ id: "cut", title: "Call Rasa Nusantara back", type: "vendor_call", startAt: "2026-10-08T16:00", status: "cancelled" }),
    ],
    [vendor()],
    [task({ id: "t1", title: "Choose the caterer", dueDate: "2026-10-18", notes: "Compare two menus" })],
  );
  const ids = (f: Partial<typeof NO_AGENDA_FILTER>) => filterAgenda(items, { ...NO_AGENDA_FILTER, ...f }).map((i) => i.id);

  it("hides completed and cancelled things unless asked", () => {
    expect(ids({})).not.toContain("old");
    expect(ids({})).not.toContain("cut");
    expect(ids({ showDone: true })).toEqual(expect.arrayContaining(["old", "cut"]));
    expect(ids({ showDone: true })).toHaveLength(items.length);
  });

  it("filters by kind", () => {
    expect(ids({ kind: "call" })).toEqual(["call", "org"]);
    expect(ids({ kind: "call", showDone: true })).toEqual(["cut", "call", "org"]);
    expect(ids({ kind: "appointment" })).toEqual(["tasting"]);
    expect(ids({ kind: "deadline" })).toEqual(["hold"]);
    expect(ids({ kind: "other" })).toEqual(["misc"]);
    expect(ids({ kind: "task" })).toEqual(["t1"]);
    expect(ids({ kind: "own" })).toEqual(["call", "tasting", "org", "pay", "hold", "misc"]);
  });

  it("includes our own Payment events in the Payments filter, with payments due on bookings", () => {
    expect(ids({ kind: "payment" })).toEqual(["vendor-v1", "pay"]);
  });

  it("searches titles, places and notes", () => {
    expect(ids({ query: "laras" })).toEqual(["call"]);
    expect(ids({ query: "kerobokan" })).toEqual(["tasting"]);
    expect(ids({ query: "both mums" })).toEqual(["tasting"]);
    expect(ids({ query: "compare two" })).toEqual(["t1"]);
    expect(ids({ query: "florist" })).toEqual([]);
  });

  it("combines kind, search and done", () => {
    expect(ids({ kind: "call", query: "rasa" })).toEqual([]);
    expect(ids({ kind: "call", query: "rasa", showDone: true })).toEqual(["cut"]);
  });

  it("offers the chips the design shows, and knows when something is filtering", () => {
    expect(AGENDA_FILTERS.map((f) => f.label)).toEqual(["Everything", "Payments", "Tasks", "Calls", "Appointments", "Deadlines", "Our events", "Other"]);
    expect(isFilteringAgenda(NO_AGENDA_FILTER)).toBe(false);
    expect(isFilteringAgenda({ ...NO_AGENDA_FILTER, showDone: true })).toBe(false);
    expect(isFilteringAgenda({ ...NO_AGENDA_FILTER, query: "x" })).toBe(true);
    expect(isFilteringAgenda({ ...NO_AGENDA_FILTER, kind: "task" })).toBe(true);
  });
});

describe("agendaGroups", () => {
  const items = build(
    [
      event({ id: "l1", title: "Late one", startAt: "2026-10-10T10:00" }),
      event({ id: "l2", title: "Late two", startAt: "2026-10-13", allDay: true }),
      event({ id: "t1", title: "Today a", startAt: "2026-10-14T09:00" }),
      event({ id: "t2", title: "Today b", startAt: "2026-10-14T15:00" }),
      event({ id: "m1", title: "Tomorrow", startAt: "2026-10-15T10:00" }),
      event({ id: "f1", title: "Next month", startAt: "2026-11-02", allDay: true }),
      event({ id: "done", title: "Done on the 10th", startAt: "2026-10-10T08:00", status: "completed" }),
    ],
  );

  it("puts Late first, then each day in order with its title", () => {
    const groups = agendaGroups(items, TODAY);
    expect(groups.map((g) => g.key)).toEqual(["late", "2026-10-10", "2026-10-14", "2026-10-15", "2026-11-02"]);
    expect(groups[0]).toMatchObject({ title: "Late", late: true, today: false, count: 2 });
    expect(groups[0].items.map((i) => i.id)).toEqual(["l1", "l2"]);
    expect(groups[2]).toMatchObject({ title: "Today, Wednesday 14 October", today: true, count: 2 });
    expect(groups[3].title).toBe("Tomorrow, Thursday 15 October");
    expect(groups[4].title).toBe("Monday 2 November");
  });

  it("files a completed past event under its own day, not under Late", () => {
    const groups = agendaGroups(items, TODAY);
    expect(groups[1]).toMatchObject({ key: "2026-10-10", late: false });
    expect(groups[1].items.map((i) => i.id)).toEqual(["done"]);
  });

  it("has no Late group when nothing is late, and no groups for nothing", () => {
    expect(agendaGroups(build([event({ startAt: "2026-10-20T10:00" })]), TODAY).map((g) => g.key)).toEqual(["2026-10-20"]);
    expect(agendaGroups([], TODAY)).toEqual([]);
  });

  it("pages across groups and keeps each group's full count", () => {
    const groups = agendaGroups(items, TODAY);
    const paged = pageGroups(groups, 4);
    expect(paged.map((g) => [g.key, g.items.length, g.count])).toEqual([
      ["late", 2, 2],
      ["2026-10-10", 1, 1],
      ["2026-10-14", 1, 2],
    ]);
    expect(pageGroups(groups, 0)).toEqual([]);
    expect(pageGroups(groups, 100).reduce((s, g) => s + g.items.length, 0)).toBe(items.length);
  });

  it("pages 1.204 events 80 at a time", () => {
    const many = Array.from({ length: 1204 }, (_, i) => event({ id: `g${i}`, startAt: `2026-11-${String(1 + (i % 28)).padStart(2, "0")}T10:00` }));
    const groups = agendaGroups(build(many), TODAY);
    expect(pageGroups(groups, 80).reduce((s, g) => s + g.items.length, 0)).toBe(80);
    expect(groups.reduce((s, g) => s + g.count, 0)).toBe(1204);
  });
});

describe("lateOrToday", () => {
  it("counts late, today, tomorrow and the next 14 days, and writes the sentence", () => {
    const items = build(
      [
        event({ id: "l", startAt: "2026-10-13", allDay: true }),
        event({ id: "t1", startAt: "2026-10-14T09:00" }),
        event({ id: "t2", startAt: "2026-10-14T15:00" }),
        event({ id: "m", startAt: "2026-10-15T10:00" }),
        event({ id: "s1", startAt: "2026-10-16T11:00" }),
        event({ id: "s2", startAt: "2026-10-28", allDay: true }),
        event({ id: "far", startAt: "2026-10-29", allDay: true }),
        event({ id: "done", startAt: "2026-10-14T08:00", status: "completed" }),
      ],
    );
    const s = lateOrToday(items, TODAY);
    expect(s).toMatchObject({ has: true, late: 1, today: 2, tomorrow: 1, soon: 2, figure: 3, kicker: "Late or due today" });
    expect(contextText(s.context)).toBe("1 late and 2 today, then 1 tomorrow. 2 more things in the next 14 days.");
    expect(s.context.filter((p) => p.emphasis).map((p) => [p.text, p.emphasis])).toEqual([
      ["1 late", "late"],
      ["2 today", "strong"],
    ]);
  });

  it("says only the late part, or only the today part, when that's all there is", () => {
    const lateOnly = lateOrToday(build([event({ startAt: "2026-10-12", allDay: true })]), TODAY);
    expect(contextText(lateOnly.context)).toBe("1 late.");
    expect(lateOnly.figure).toBe(1);
    const todayOnly = lateOrToday(build([event({ startAt: "2026-10-14T10:00" }), event({ startAt: "2026-10-15T10:00" })]), TODAY);
    expect(contextText(todayOnly.context)).toBe("1 today, then 1 tomorrow.");
  });

  it("leads with tomorrow when nothing is late or due today", () => {
    const s = lateOrToday(build([event({ startAt: "2026-10-15T10:00" }), event({ startAt: "2026-10-15T14:00" }), event({ startAt: "2026-10-20T10:00" })]), TODAY);
    expect(s).toMatchObject({ late: 0, today: 0, tomorrow: 2, figure: 2, kicker: "Nothing late or due today. Tomorrow:" });
    expect(contextText(s.context)).toBe("2 things tomorrow. 1 more thing in the next 14 days.");
  });

  it("is calm when nothing is near, and empty when nothing is scheduled", () => {
    const far = lateOrToday(build([event({ startAt: "2026-12-01T10:00" })]), TODAY);
    expect(far).toMatchObject({ has: true, figure: 0, kicker: "Nothing late or due today" });
    expect(contextText(far.context)).toBe("");
    const none = lateOrToday([], TODAY);
    expect(none).toMatchObject({ has: false, figure: 0, late: 0, today: 0, tomorrow: 0, soon: 0 });
  });

  it("counts payments and tasks as well as events", () => {
    const items = build([], [vendor({ nextTargetDate: "2026-10-11" })], [task({ dueDate: "2026-10-14" })]);
    expect(lateOrToday(items, TODAY)).toMatchObject({ late: 1, today: 1, figure: 2 });
  });

  it("follows the real today, whatever month is on screen (§5 #11)", () => {
    const items = build([event({ startAt: "2026-10-14T09:00" })]);
    expect(lateOrToday(items, "2026-10-14").today).toBe(1);
    expect(lateOrToday(items, "2026-10-15").late).toBe(1);
  });

  it("counts the 14th day ahead but not the 15th", () => {
    const items = build([event({ startAt: "2026-10-28", allDay: true }), event({ startAt: "2026-10-29", allDay: true })]);
    expect(lateOrToday(items, TODAY).soon).toBe(1);
  });
});

describe("comingUp", () => {
  it("takes the first five things still scheduled, late ones first", () => {
    const items = build(
      Array.from({ length: 8 }, (_, i) => event({ id: `e${i}`, startAt: `2026-10-${String(10 + i * 2).padStart(2, "0")}T10:00`, status: i === 0 ? "completed" : "scheduled" })),
    );
    const next = comingUp(items);
    expect(next.map((i) => i.id)).toEqual(["e1", "e2", "e3", "e4", "e5"]);
    expect(isLate(next[0], TODAY)).toBe(true);
    expect(isLate(next[1], TODAY)).toBe(false);
    expect(comingUp(items, 2)).toHaveLength(2);
    expect(comingUp([])).toEqual([]);
  });

  it("includes what's late", () => {
    expect(comingUp(build([event({ id: "old", startAt: "2026-10-01T10:00" })])).map((i) => i.id)).toEqual(["old"]);
  });
});

describe("monthCells", () => {
  const cellFor = (cells: ReturnType<typeof monthCells>, date: string) => cells.find((c) => c.date === date)!;

  it("starts with blanks so the 1st lands in a Monday-first grid", () => {
    // 1 Oct 2026 is a Thursday: three blanks (Mon, Tue, Wed).
    const oct = monthCells({ year: 2026, month: 10, items: [], today: TODAY, selected: null, wedding: null });
    expect(oct.slice(0, 3).every((c) => c.date === null)).toBe(true);
    expect(oct[3].date).toBe("2026-10-01");
    expect(oct).toHaveLength(3 + 31);
    // 1 Nov 2026 is a Sunday: six blanks.
    const nov = monthCells({ year: 2026, month: 11, items: [], today: TODAY, selected: null, wedding: null });
    expect(nov.filter((c) => c.date === null)).toHaveLength(6);
    // 1 Jun 2026 is a Monday: none.
    const jun = monthCells({ year: 2026, month: 6, items: [], today: TODAY, selected: null, wedding: null });
    expect(jun[0].date).toBe("2026-06-01");
  });

  it("has the right number of days in February, leap or not, and at the year end", () => {
    const days = (y: number, m: number) => monthCells({ year: y, month: m, items: [], today: TODAY, selected: null, wedding: null }).filter((c) => c.date).length;
    expect(days(2026, 2)).toBe(28);
    expect(days(2028, 2)).toBe(29);
    expect(days(2026, 12)).toBe(31);
    const dec = monthCells({ year: 2026, month: 12, items: [], today: TODAY, selected: null, wedding: null });
    expect(dec[dec.length - 1].date).toBe("2026-12-31");
    // 1 Jan 2027 is a Friday: four blanks.
    expect(monthCells({ year: 2027, month: 1, items: [], today: TODAY, selected: null, wedding: null }).filter((c) => !c.date)).toHaveLength(4);
  });

  it("marks today, the selected day and the wedding day", () => {
    const cells = monthCells({ year: 2026, month: 10, items: [], today: TODAY, selected: "2026-10-20", wedding: "2026-10-31" });
    expect(cellFor(cells, "2026-10-14")).toMatchObject({ today: true, selected: false, wedding: false });
    expect(cellFor(cells, "2026-10-20")).toMatchObject({ today: false, selected: true });
    expect(cellFor(cells, "2026-10-31")).toMatchObject({ wedding: true });
    expect(cells.filter((c) => c.today)).toHaveLength(1);
  });

  it("shows no today in another month", () => {
    const cells = monthCells({ year: 2026, month: 11, items: [], today: TODAY, selected: null, wedding: null });
    expect(cells.some((c) => c.today)).toBe(false);
  });

  const items = build(
    [
      event({ id: "e1", startAt: "2026-10-14T15:00" }),
      event({ id: "e2", startAt: "2026-10-14T16:00" }),
      event({ id: "late", startAt: "2026-10-12", allDay: true }),
    ],
    [vendor({ nextTargetDate: "2026-10-30" })],
    [task({ dueDate: "2026-10-30" })],
  );

  it("shows up to three dots and counts the rest, late ones as late", () => {
    const cells = monthCells({ year: 2026, month: 10, items, today: TODAY, selected: null, wedding: null });
    expect(cellFor(cells, "2026-10-14")).toMatchObject({ dots: ["event", "event"], more: 0 });
    expect(cellFor(cells, "2026-10-12")).toMatchObject({ dots: ["late"], more: 0 });
    expect(cellFor(cells, "2026-10-30")).toMatchObject({ dots: ["payment", "task"], more: 0 });
    expect(cellFor(cells, "2026-10-13").dots).toEqual([]);
    const crowded = build(Array.from({ length: 5 }, (_, i) => event({ id: `c${i}`, startAt: "2026-10-20T10:00" })));
    const cell = cellFor(monthCells({ year: 2026, month: 10, items: crowded, today: TODAY, selected: null, wedding: null }), "2026-10-20");
    expect(cell.dots).toHaveLength(3);
    expect(cell.more).toBe(2);
  });

  it("writes a label that says everything the marks show", () => {
    const cells = monthCells({ year: 2026, month: 10, items, today: TODAY, selected: "2026-10-14", wedding: "2026-10-30" });
    expect(cellFor(cells, "2026-10-14").label).toBe("Wednesday 14 October, today, selected, 2 events");
    expect(cellFor(cells, "2026-10-30").label).toBe("Friday 30 October, the wedding day, 1 payment, 1 task");
    expect(cellFor(cells, "2026-10-12").label).toBe("Monday 12 October, 1 late");
    expect(cellFor(cells, "2026-10-13").label).toBe("Tuesday 13 October, nothing");
  });

  it("labels the wedding day with its year when it isn't this year", () => {
    const cells = monthCells({ year: 2027, month: 3, items: [], today: TODAY, selected: null, wedding: "2027-03-20" });
    expect(cellFor(cells, "2027-03-20").label).toBe("Saturday 20 March 2027, the wedding day, nothing");
  });

  it("counts several of a kind", () => {
    const two = build([event({ startAt: "2026-10-20T10:00" }), event({ startAt: "2026-10-20T11:00" })], [vendor({ nextTargetDate: "2026-10-20" })]);
    expect(cellFor(monthCells({ year: 2026, month: 10, items: two, today: TODAY, selected: null, wedding: null }), "2026-10-20").label).toBe(
      "Tuesday 20 October, 1 payment, 2 events",
    );
  });

  it("marks a completed past event as an event, not as late", () => {
    const done = build([event({ startAt: "2026-10-10T10:00", status: "completed" })]);
    expect(cellFor(monthCells({ year: 2026, month: 10, items: done, today: TODAY, selected: null, wedding: null }), "2026-10-10").dots).toEqual(["event"]);
  });

  it("finds the things on one day", () => {
    expect(itemsOn(items, "2026-10-14").map((i) => i.id)).toEqual(["e1", "e2"]);
    expect(itemsOn(items, "2026-10-01")).toEqual([]);
  });

  it("handles 1.204 events in a month grid", () => {
    const many: AgendaItem[] = build(Array.from({ length: 1204 }, (_, i) => event({ id: `g${i}`, startAt: `2026-10-${String(1 + (i % 31)).padStart(2, "0")}T10:00` })));
    const cells = monthCells({ year: 2026, month: 10, items: many, today: TODAY, selected: null, wedding: null });
    expect(cells.filter((c) => c.date).every((c) => c.dots.length === 3 && c.more > 0)).toBe(true);
  });
});
