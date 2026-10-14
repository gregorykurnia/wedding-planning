import { describe, expect, it } from "vitest";
import type { EventRecord } from "@/lib/model/agenda";
import { remindersDue } from "@/lib/model/reminders";

// Built in the local zone, which is the zone reminders are worked out in.
const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

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

const minutes = (events: EventRecord[], now: number) => remindersDue(events, now).map((r) => [r.event.id, r.minutes]);

describe("remindersDue", () => {
  it("is due once its moment has come: '1 day before' an 11:00 event is 11:00 the day before", () => {
    const e = event({ id: "a" });
    expect(minutes([e], at(2026, 10, 15, 10, 59))).toEqual([]);
    expect(minutes([e], at(2026, 10, 15, 11, 0))).toEqual([["a", 1440]]);
    expect(minutes([e], at(2026, 10, 15, 23, 0))).toEqual([["a", 1440]]);
  });

  it("stays due until the event starts, and is useless after", () => {
    const e = event({ id: "a" });
    expect(minutes([e], at(2026, 10, 16, 10, 59))).toEqual([["a", 1440]]);
    expect(minutes([e], at(2026, 10, 16, 11, 0))).toEqual([]);
    expect(minutes([e], at(2026, 10, 17, 9, 0))).toEqual([]);
  });

  it("only reaches a morning run on the event's own day when the event is in the afternoon", () => {
    // A once-a-day run at 07:00 sees an afternoon event's "1 day before" (15:00 the day before) the next morning. Need N11 covers this.
    const e = event({ id: "a", startAt: "2026-10-16T15:00" });
    expect(minutes([e], at(2026, 10, 15, 7, 0))).toEqual([]);
    expect(minutes([e], at(2026, 10, 16, 7, 0))).toEqual([["a", 1440]]);
  });

  it("sends '1 week before' a week ahead", () => {
    const e = event({ id: "a", reminderMinutes: [10080] });
    expect(minutes([e], at(2026, 10, 9, 10, 59))).toEqual([]);
    expect(minutes([e], at(2026, 10, 9, 11, 0))).toEqual([["a", 10080]]);
  });

  it("reads 'when it starts' as due at the start time, which is already the end of its use for a timed event", () => {
    const e = event({ id: "a", reminderMinutes: [0] });
    expect(minutes([e], at(2026, 10, 16, 10, 59))).toEqual([]);
    expect(minutes([e], at(2026, 10, 16, 11, 0))).toEqual([]);
  });

  it("treats all-day events as starting at midnight and useful all day", () => {
    const e = event({ id: "a", startAt: "2026-11-28", allDay: true, reminderMinutes: [1440, 0] });
    expect(minutes([e], at(2026, 11, 26, 23, 59))).toEqual([]);
    expect(minutes([e], at(2026, 11, 27, 0, 0))).toEqual([["a", 1440]]);
    expect(minutes([e], at(2026, 11, 28, 7, 0))).toEqual([["a", 1440], ["a", 0]]);
    expect(minutes([e], at(2026, 11, 28, 23, 59))).toEqual([["a", 1440], ["a", 0]]);
    expect(minutes([e], at(2026, 11, 29, 0, 0))).toEqual([]);
  });

  it("skips what was already sent, and sends the rest", () => {
    const e = event({ id: "a", reminderMinutes: [10080, 1440], remindersSent: [10080] });
    expect(minutes([e], at(2026, 10, 15, 12, 0))).toEqual([["a", 1440]]);
    expect(minutes([event({ id: "b", remindersSent: [1440] })], at(2026, 10, 15, 12, 0))).toEqual([]);
  });

  it("skips completed and cancelled events and events with no reminder", () => {
    const now = at(2026, 10, 15, 12, 0);
    expect(minutes([event({ id: "a", status: "completed" }), event({ id: "b", status: "cancelled" }), event({ id: "c", reminderMinutes: [] })], now)).toEqual([]);
  });

  it("skips an event whose date isn't real, and nonsense minutes", () => {
    const now = at(2026, 10, 15, 12, 0);
    expect(minutes([event({ id: "a", startAt: "2026-02-30T10:00" })], now)).toEqual([]);
    expect(minutes([event({ id: "b", reminderMinutes: [-5, NaN] })], now)).toEqual([]);
  });

  it("lists each reminder once, earliest first", () => {
    const e1 = event({ id: "a", startAt: "2026-10-16T09:00", reminderMinutes: [1440, 1440, 60] });
    const e2 = event({ id: "b", startAt: "2026-10-15T09:30", reminderMinutes: [60] });
    expect(remindersDue([e1, e2], at(2026, 10, 15, 8, 0))).toEqual([]);
    const out = remindersDue([e1, e2], at(2026, 10, 15, 9, 15));
    expect(out.map((r) => [r.event.id, r.minutes])).toEqual([["b", 60], ["a", 1440]]);
    expect(out[0].at).toBeLessThan(out[1].at);
  });

  it("says when each was due and when the event starts", () => {
    const [r] = remindersDue([event({ id: "a" })], at(2026, 10, 15, 12, 0));
    expect(r.at).toBe(at(2026, 10, 15, 11, 0));
    expect(r.startsAt).toBe(at(2026, 10, 16, 11, 0));
  });

  it("works across a month and a year end", () => {
    const e = event({ id: "a", startAt: "2027-01-01T09:00", reminderMinutes: [1440] });
    expect(minutes([e], at(2026, 12, 31, 8, 59))).toEqual([]);
    expect(minutes([e], at(2026, 12, 31, 9, 0))).toEqual([["a", 1440]]);
  });
});
