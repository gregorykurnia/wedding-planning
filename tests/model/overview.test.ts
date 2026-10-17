import { describe, expect, it } from "vitest";
import type { EventRecord } from "@/lib/model/agenda";
import type { Booking } from "@/lib/model/bookings";
import type { GuestRecord } from "@/lib/model/guests";
import type { ItemRecord } from "@/lib/model/items";
import {
  comingFor,
  comingTitle,
  countdown,
  dateSaved,
  heroWords,
  overviewDoors,
  timeThread,
} from "@/lib/model/overview";
import type { TaskRecord } from "@/lib/model/tasks";

// Task 4.2: the words and numbers of the overview (guide §5.2), read without
// rendering. 2026-10-14 is a Wednesday.

const TODAY = "2026-10-14";

describe("countdown", () => {
  it("counts days before the wedding", () => {
    expect(countdown("2027-03-20", TODAY)).toEqual({ phase: "before", days: 157 });
  });

  it("is the day itself on the day, and after on any day past it, never negative", () => {
    expect(countdown(TODAY, TODAY)).toEqual({ phase: "day" });
    expect(countdown("2026-10-02", TODAY)).toEqual({ phase: "after" });
  });

  it("is null without a real date", () => {
    expect(countdown(null, TODAY)).toBeNull();
    expect(countdown("", TODAY)).toBeNull();
    expect(countdown("2027-02-30x", TODAY)).toBeNull();
  });
});

describe("heroWords", () => {
  it("counts down with the date and the year when it isn't this year", () => {
    expect(heroWords({ phase: "before", days: 157 }, "2027-03-20", TODAY)).toEqual({
      kicker: null,
      figure: "157",
      context: "days until Saturday 20 March 2027",
    });
  });

  it("groups thousands with dots", () => {
    expect(heroWords({ phase: "before", days: 1234 }, "2030-03-01", TODAY).figure).toBe("1.234");
  });

  it("says tomorrow the day before", () => {
    expect(heroWords({ phase: "before", days: 1 }, "2026-10-15", TODAY)).toEqual({
      kicker: null,
      figure: "1",
      context: "day to go: tomorrow, Thursday 15 October",
    });
  });

  it("is the word Today on the day", () => {
    expect(heroWords({ phase: "day" }, TODAY, TODAY)).toEqual({
      kicker: "The wedding day",
      figure: "Today",
      context: "Wednesday 14 October. Everything for today is below.",
    });
  });

  it("ends the count after the day: Married and the date, no figure", () => {
    expect(heroWords({ phase: "after" }, "2026-10-02", TODAY)).toEqual({
      kicker: "Married",
      figure: null,
      context: "Friday 2 October",
    });
  });
});

describe("timeThread", () => {
  it("shows the share of the time gone, between the start and the wedding", () => {
    // 2026-08-02 to 2027-03-20 is 230 days; 73 have passed.
    const thread = timeThread({ phase: "before", days: 157 }, "2026-08-02", "2027-03-20", TODAY);
    expect(thread).toEqual({
      fill: 32,
      label: "32% of the preparation time has passed",
      start: "Started 2 Aug",
      end: "32% of the time gone",
    });
  });

  it("is left out when the start day isn't known (N8)", () => {
    expect(timeThread({ phase: "before", days: 157 }, null, "2027-03-20", TODAY)).toBeNull();
  });

  it("is full on the day, with or without a start day", () => {
    expect(timeThread({ phase: "day" }, "2026-08-02", TODAY, TODAY)).toEqual({
      fill: 100,
      label: "All of the preparation time has passed",
      start: "Started 2 Aug",
      end: "The day is here",
    });
    expect(timeThread({ phase: "day" }, null, TODAY, TODAY)?.start).toBe("");
  });

  it("is gone after the wedding", () => {
    expect(timeThread({ phase: "after" }, "2026-08-02", "2026-10-02", TODAY)).toBeNull();
  });
});

describe("comingTitle", () => {
  it("changes on the wedding day only", () => {
    expect(comingTitle({ phase: "day" })).toBe("Today and next");
    expect(comingTitle({ phase: "before", days: 3 })).toBe("Coming up");
    expect(comingTitle({ phase: "after" })).toBe("Coming up");
    expect(comingTitle(null)).toBe("Coming up");
  });
});

describe("dateSaved", () => {
  it("names the day", () => {
    expect(dateSaved("2027-03-20", TODAY)).toBe("Wedding date set to Saturday 20 March 2027");
  });
});

const booking = (id: string, price: number, paid: number, due: string | null): Booking => ({
  id,
  kind: "vendor",
  recordId: id,
  name: `Booking ${id}`,
  category: "Catering",
  price,
  paid,
  funder: null,
  due,
  step: "",
  parts: [],
  estimate: null,
  bookedOn: null,
  from: "vendor",
  direct: false,
});

const event = (id: string, startAt: string, status: EventRecord["status"] = "scheduled"): EventRecord => ({
  id,
  title: `Event ${id}`,
  type: "appointment",
  startAt,
  endAt: null,
  allDay: false,
  notes: "",
  location: "",
  status,
  relatedVendorId: null,
  relatedVenueId: null,
  reminderMinutes: [],
});

const task = (id: string, dueDate: string | null, done = false): TaskRecord => ({
  id,
  title: `Task ${id}`,
  notes: "",
  dueDate,
  done,
  subtasks: [],
});

describe("comingFor", () => {
  it("merges events, payments due and dated open tasks, soonest first, five at most", () => {
    const events = ["2026-10-20", "2026-10-21", "2026-10-22"].map((d, i) => event(`e${i}`, `${d}T10:00`));
    const bookings = [booking("b1", 1000, 0, "2026-10-16")];
    const tasks = [task("t1", "2026-10-15"), task("t2", null), task("t3", "2026-10-17", true)];
    const keys = comingFor(events, bookings, tasks, TODAY).map((i) => i.key);
    expect(keys).toEqual(["task:t1", "payment:b1:", "event:e0", "event:e1", "event:e2"]);
  });

  it("puts late things first and leaves out finished and cancelled ones", () => {
    const events = [event("old", "2026-10-10T09:00"), event("gone", "2026-10-16T09:00", "cancelled")];
    const keys = comingFor(events, [], [task("done", "2026-10-15", true)], TODAY).map((i) => i.key);
    expect(keys).toEqual(["event:old"]);
  });

  it("is empty when nothing is dated", () => {
    expect(comingFor([], [booking("b1", 1000, 0, null)], [task("t1", null)], TODAY)).toEqual([]);
  });
});

const guest = (id: string, rsvpStatus: GuestRecord["rsvpStatus"], plusOnes = 0): GuestRecord => ({
  id,
  name: id,
  connection: "",
  country: "",
  allergies: "",
  rsvpStatus,
  eventType: "Both",
  inviteSent: true,
  plusOnes,
});

const item = (id: string, confirmed: boolean): ItemRecord => ({
  id,
  item: id,
  vendor: "",
  confirmed,
  types: [],
  persons: [],
  next: false,
  sortOrder: 0,
});

describe("overviewDoors", () => {
  it("says nothing yet in each when there is nothing", () => {
    const doors = overviewDoors({ bookings: [], tasks: [], guests: [], items: [] });
    expect(doors.map((d) => [d.name, d.summary])).toEqual([
      ["Budget", "Nothing booked yet"],
      ["Tasks", "No tasks yet"],
      ["Guests", "No guests yet"],
      ["Wedding items", "Nothing tracked yet"],
    ]);
  });

  it("leads to the budget, tasks, guests and wedding items", () => {
    const doors = overviewDoors({ bookings: [], tasks: [], guests: [], items: [] });
    expect(doors.map((d) => d.path)).toEqual(["/budget", "/schedule/tasks", "/guests", "/items"]);
  });

  it("reads the counts, with plus-ones among those attending", () => {
    const doors = overviewDoors({
      bookings: [booking("a", 800_000_000, 400_000_000, null), booking("b", 82_800_000, 73_150_000, null)],
      tasks: [task("a", null, true), task("b", null, true), task("c", null), task("d", null), task("e", null), task("f", null), task("g", null)],
      guests: [guest("a", "yes", 2), guest("b", "yes"), guest("c", "pending"), guest("d", "no")],
      items: [item("a", true), item("b", false), item("c", true)],
    });
    expect(doors.map((d) => d.summary)).toEqual([
      "Rp 473.150.000 paid of Rp 882.800.000",
      "2 of 7 tasks done",
      "4 attending of 4 guests invited",
      "2 of 3 confirmed",
    ]);
  });

  it("uses the singular for one task or one guest", () => {
    const doors = overviewDoors({ bookings: [], tasks: [task("a", null)], guests: [guest("a", "pending")], items: [] });
    expect(doors[1].summary).toBe("0 of 1 task done");
    expect(doors[2].summary).toBe("0 attending of 1 guest invited");
  });

  it("groups thousands with dots", () => {
    const guests = Array.from({ length: 1200 }, (_, i) => guest(`g${i}`, "yes"));
    expect(overviewDoors({ bookings: [], tasks: [], guests, items: [] })[2].summary).toBe("1.200 attending of 1.200 guests invited");
  });
});
