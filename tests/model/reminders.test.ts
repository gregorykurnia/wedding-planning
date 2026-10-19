import { describe, expect, it } from "vitest";
import type { EventRecord } from "@/lib/model/agenda";
import { TEST_PUSH, plannerClock, reminderPush, remindersDue } from "@/lib/model/reminders";

const event = (over: Partial<EventRecord> = {}): EventRecord => ({
  id: "e",
  title: "Tasting at Sendok Emas",
  type: "appointment",
  startAt: "2026-10-16T11:00",
  endAt: null,
  allDay: false,
  notes: "",
  location: "",
  status: "scheduled",
  relatedVendorId: null,
  relatedVenueId: null,
  reminderMinutes: [1440],
  ...over,
});

const due = (events: EventRecord[], today: string, now = "07:00") =>
  remindersDue(events, today as `${number}-${number}-${number}`, now).map((r) => [r.event.id, r.minutes]);

describe("remindersDue (N11: once a day, in the morning)", () => {
  it("sends 'the morning before' on the morning of the day before, whatever time the event is", () => {
    for (const startAt of ["2026-10-16T08:00", "2026-10-16T11:00", "2026-10-16T19:30", "2026-10-16"]) {
      const e = event({ id: "a", startAt, allDay: startAt.length === 10 });
      expect(due([e], "2026-10-14")).toEqual([]);
      expect(due([e], "2026-10-15")).toEqual([["a", 1440]]);
    }
  });

  it("sends 'a week before' seven mornings ahead", () => {
    const e = event({ id: "a", reminderMinutes: [10080] });
    expect(due([e], "2026-10-08")).toEqual([]);
    expect(due([e], "2026-10-09")).toEqual([["a", 10080]]);
  });

  it("catches up a morning missed yesterday, but not older ones", () => {
    const week = event({ id: "w", startAt: "2026-10-20T11:00", reminderMinutes: [10080] });
    expect(due([week], "2026-10-14")).toEqual([["w", 10080]]);
    expect(due([week], "2026-10-15")).toEqual([]);
    // The morning before a 15:00 event, missed: still sent on its own morning, while it's still to come.
    const day = event({ id: "d", startAt: "2026-10-16T15:00" });
    expect(due([day], "2026-10-16", "07:00")).toEqual([["d", 1440]]);
    expect(due([day], "2026-10-16", "15:00")).toEqual([]);
  });

  it("sends nothing for an event that has started or passed; all day lasts until midnight", () => {
    expect(due([event({ id: "a", startAt: "2026-10-16T07:00" })], "2026-10-16", "07:00")).toEqual([]);
    expect(due([event({ id: "b", startAt: "2026-10-16", allDay: true })], "2026-10-16", "23:59")).toEqual([["b", 1440]]);
    expect(due([event({ id: "c", startAt: "2026-10-15T11:00" })], "2026-10-16")).toEqual([]);
  });

  it("never sends a reminder set for a time of day: it can't arrive, and the schedule names it", () => {
    for (const minutes of [0, 15, 60]) {
      expect(due([event({ id: "a", startAt: "2026-10-15T11:00", reminderMinutes: [minutes] })], "2026-10-15")).toEqual([]);
    }
  });

  it("skips what was already sent, and sends the rest", () => {
    const e = event({ id: "a", startAt: "2026-10-16T11:00", reminderMinutes: [10080, 1440], remindersSent: [10080] });
    expect(due([e], "2026-10-15")).toEqual([["a", 1440]]);
    expect(due([event({ id: "b", remindersSent: [1440] })], "2026-10-15")).toEqual([]);
  });

  it("skips completed and cancelled events, events with no reminder, and dates that aren't real", () => {
    const today = "2026-10-15";
    expect(
      due(
        [
          event({ id: "a", status: "completed" }),
          event({ id: "b", status: "cancelled" }),
          event({ id: "c", reminderMinutes: [] }),
          event({ id: "d", startAt: "2026-02-30T10:00" }),
          event({ id: "e", reminderMinutes: [-5, NaN] }),
        ],
        today,
      ),
    ).toEqual([]);
  });

  it("lists each reminder once, soonest event first", () => {
    const e1 = event({ id: "a", startAt: "2026-10-16T15:00", reminderMinutes: [1440, 1440] });
    const e2 = event({ id: "b", startAt: "2026-10-16T09:30" });
    const e3 = event({ id: "c", startAt: "2026-10-22", allDay: true, reminderMinutes: [10080] });
    const out = remindersDue([e3, e1, e2], "2026-10-15", "07:00");
    expect(out.map((r) => [r.event.id, r.minutes])).toEqual([["b", 1440], ["a", 1440], ["c", 10080]]);
    expect(out[0]).toMatchObject({ morning: "2026-10-15", date: "2026-10-16" });
  });

  it("works across a month and a year end", () => {
    const e = event({ id: "a", startAt: "2027-01-01T09:00" });
    expect(due([e], "2026-12-30")).toEqual([]);
    expect(due([e], "2026-12-31")).toEqual([["a", 1440]]);
  });
});

describe("plannerClock", () => {
  it("reads the day and time in Jakarta: the 00:00 UTC run is 07:00 the same day", () => {
    expect(plannerClock(new Date("2026-10-15T00:05:00Z"))).toEqual({ today: "2026-10-15", now: "07:05" });
    expect(plannerClock(new Date("2026-10-15T17:30:00Z"))).toEqual({ today: "2026-10-16", now: "00:30" });
    expect(plannerClock(new Date("2026-10-15T00:05:00Z"), "Asia/Makassar")).toEqual({ today: "2026-10-15", now: "08:05" });
  });
});

describe("reminderPush", () => {
  const href = (id: string) => `/new/schedule?event=${id}`;

  it("names the event, its day and time, and the place", () => {
    const [r] = remindersDue([event({ id: "a", location: "Sendok Emas, Kemang" })], "2026-10-15", "07:00");
    expect(reminderPush(r, "2026-10-15", href)).toEqual({
      title: "Tasting at Sendok Emas",
      body: "Tomorrow, Friday 16 October, 11:00\nSendok Emas, Kemang",
      url: "/new/schedule?event=a",
      tag: "reminder-a-1440",
    });
  });

  it("says all day, leaves out a call link, and has a title when the event has none", () => {
    const [r] = remindersDue(
      [event({ id: "b", title: " ", startAt: "2026-10-22", allDay: true, location: "https://meet.example/x", reminderMinutes: [10080] })],
      "2026-10-15",
      "07:00",
    );
    const push = reminderPush(r, "2026-10-15", href);
    expect(push.title).toBe("Something in the schedule");
    expect(push.body).toBe("Thursday 22 October, all day");
  });

  it("says Today for a morning caught up on the event's own day", () => {
    const [r] = remindersDue([event({ id: "c", startAt: "2026-10-16T15:00" })], "2026-10-16", "07:00");
    expect(reminderPush(r, "2026-10-16", href).body).toBe("Today, Friday 16 October, 15:00");
  });

  it("has a test push", () => {
    expect(TEST_PUSH.title).toBe("Test reminder");
  });
});
