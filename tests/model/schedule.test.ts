import { describe, expect, it } from "vitest";
import {
  defaultReminder,
  eventProblems,
  heldLine,
  kindOf,
  needLine,
  oldReminderLine,
  relatedValue,
  reminderCantArrive,
  reminderMinutesOf,
  reminderOptions,
  reminderPast,
  reminderState,
  storedEvent,
  storedWhen,
  whenOf,
} from "@/lib/model/schedule";

const TODAY = "2026-10-14";

describe("reminders (N11)", () => {
  it("reads the stored minutes as one choice", () => {
    expect(reminderState([])).toEqual({ kind: "choice", key: "" });
    expect(reminderState(undefined)).toEqual({ kind: "choice", key: "" });
    expect(reminderState([1440])).toEqual({ kind: "choice", key: "1d" });
    expect(reminderState([10080])).toEqual({ kind: "choice", key: "7d" });
  });

  it("names a reminder set for a time of day instead of switching it", () => {
    expect(reminderState([0])).toEqual({ kind: "old", minutes: 0, label: "When it starts" });
    expect(reminderState([15])).toEqual({ kind: "old", minutes: 15, label: "15 minutes before" });
    expect(reminderState([60])).toEqual({ kind: "old", minutes: 60, label: "1 hour before" });
    expect(reminderState([90])).toEqual({ kind: "old", minutes: 90, label: "90 minutes before" });
  });

  it("stores a choice as minutes", () => {
    expect(reminderMinutesOf("")).toEqual([]);
    expect(reminderMinutesOf("1d")).toEqual([1440]);
    expect(reminderMinutesOf("7d")).toEqual([10080]);
  });

  it("greys a morning that has gone", () => {
    // The morning before an event tomorrow is this morning: gone.
    expect(reminderPast("1d", "2026-10-15", TODAY)).toBe(true);
    expect(reminderPast("1d", "2026-10-14", TODAY)).toBe(true);
    expect(reminderPast("1d", "2026-10-16", TODAY)).toBe(false);
    expect(reminderPast("7d", "2026-10-21", TODAY)).toBe(true);
    expect(reminderPast("7d", "2026-10-22", TODAY)).toBe(false);
    expect(reminderPast("", "2026-10-14", TODAY)).toBe(false);
    expect(reminderPast("1d", null, TODAY)).toBe(false);
  });

  it("offers the three choices, with the reason on a gone morning", () => {
    expect(reminderOptions("2026-10-15", TODAY)).toEqual([
      { value: "", label: "No reminder", disabled: false },
      { value: "1d", label: "The morning before (that morning has gone)", disabled: true },
      { value: "7d", label: "A week before, in the morning (that morning has gone)", disabled: true },
    ]);
    expect(reminderOptions("2026-11-20", TODAY).every((o) => !o.disabled)).toBe(true);
  });

  it("starts a new event on the morning before unless it has gone", () => {
    expect(defaultReminder("2026-10-20", TODAY)).toBe("1d");
    expect(defaultReminder("2026-10-15", TODAY)).toBe("");
  });

  it("flags only a scheduled event still to come with a time-of-day reminder", () => {
    const e = { status: "scheduled" as const, reminderMinutes: [60], startAt: "2026-10-14T15:00" };
    expect(reminderCantArrive(e, TODAY)).toBe(true);
    expect(reminderCantArrive({ ...e, startAt: "2026-10-13T15:00" }, TODAY)).toBe(false);
    expect(reminderCantArrive({ ...e, status: "completed" }, TODAY)).toBe(false);
    expect(reminderCantArrive({ ...e, reminderMinutes: [1440] }, TODAY)).toBe(false);
    expect(reminderCantArrive({ ...e, reminderMinutes: [] }, TODAY)).toBe(false);
  });

  it("says what was chosen and what can still arrive", () => {
    expect(oldReminderLine("1 hour before", "2026-10-30", TODAY)).toBe(
      "You chose “1 hour before” when you set this up. That can’t arrive: reminders come once a day, in the morning. Choose the morning before, a week before or no reminder.",
    );
    expect(oldReminderLine("When it starts", "2026-10-18", TODAY)).toContain("Choose the morning before or no reminder.");
    expect(oldReminderLine("15 minutes before", "2026-10-15", TODAY)).toContain("Its mornings have gone, so choose no reminder.");
  });
});

describe("an event's time", () => {
  it("reads a stored event as the sheet shows it", () => {
    expect(whenOf({ startAt: "2026-10-14T15:00", endAt: "2026-10-14T15:30", allDay: false })).toEqual({
      date: "2026-10-14",
      allDay: false,
      start: "15:00",
      end: "15:30",
    });
    expect(whenOf({ startAt: "2026-10-14", endAt: null, allDay: true })).toEqual({
      date: "2026-10-14",
      allDay: true,
      start: "",
      end: "",
    });
    // A date alone reads as all day, whatever was stored.
    expect(whenOf({ startAt: "2026-10-14", endAt: null, allDay: false }).allDay).toBe(true);
  });

  it("stores a date, a start and an end", () => {
    expect(storedWhen({ date: "2026-10-14", allDay: false, start: "15:00", end: "15:30" })).toEqual({
      startAt: "2026-10-14T15:00",
      endAt: "2026-10-14T15:30",
      allDay: false,
    });
    expect(storedWhen({ date: "2026-10-14", allDay: true, start: "15:00", end: "15:30" })).toEqual({
      startAt: "2026-10-14",
      endAt: null,
      allDay: true,
    });
    expect(storedWhen({ date: "2026-10-14", allDay: false, start: "", end: "" }).startAt).toBe("2026-10-14");
  });

  it("never stores an end before the start, or an end with no start", () => {
    expect(storedWhen({ date: "2026-10-14", allDay: false, start: "11:00", end: "10:30" }).endAt).toBeNull();
    expect(storedWhen({ date: "2026-10-14", allDay: false, start: "", end: "10:30" }).endAt).toBeNull();
    expect(storedWhen({ date: "2026-10-14", allDay: false, start: "10:30", end: "10:30" }).endAt).toBe("2026-10-14T10:30");
  });
});

describe("what an event needs (N9)", () => {
  const ok = { title: "Tasting", date: "2026-10-16", allDay: false, start: "10:00", end: "11:00" };

  it("finds nothing wrong with a complete event", () => {
    expect(eventProblems(ok)).toEqual([]);
    expect(eventProblems({ ...ok, end: "" })).toEqual([]);
    expect(eventProblems({ ...ok, start: "", end: "" })).toEqual([]);
  });

  it("needs a title and a date", () => {
    expect(eventProblems({ ...ok, title: "   " })).toEqual(["title"]);
    expect(eventProblems({ ...ok, date: "" })).toEqual(["date"]);
    expect(eventProblems({ ...ok, title: "", date: "" })).toEqual(["title", "date"]);
  });

  it("refuses an end before the start, but not for an all-day event", () => {
    expect(eventProblems({ ...ok, start: "11:00", end: "10:30" })).toEqual(["end"]);
    expect(eventProblems({ ...ok, allDay: true, start: "11:00", end: "10:30" })).toEqual([]);
  });

  it("says what to do, and what the schedule keeps", () => {
    expect(needLine("title", null, TODAY)).toBe("Give it a title so you can find it in the schedule.");
    expect(needLine("date", null, TODAY)).toBe("Choose the day it happens.");
    expect(needLine("end", null, TODAY)).toBe("It ends before it starts. Change the end time, or leave it empty.");
    const kept = { title: "Tasting at Sendok Emas", date: "2026-10-16" };
    expect(needLine("title", kept, TODAY)).toBe("It needs a title. The schedule keeps “Tasting at Sendok Emas” until you give it one.");
    expect(needLine("date", kept, TODAY)).toBe("It needs a date. The schedule keeps it on Friday 16 October until you choose one.");
  });

  it("counts what the save line holds", () => {
    expect(heldLine(["end"])).toBe("1 change not saved yet: the end time");
    expect(heldLine(["title", "date"])).toBe("2 changes not saved yet: the title and the date");
  });
});

describe("storing an event", () => {
  it("writes the fields the old screens read", () => {
    expect(
      storedEvent({
        title: "  Tasting at Sendok Emas ",
        kind: "appointment",
        when: { date: "2026-10-16", allDay: false, start: "10:00", end: "" },
        related: "vendor:v1",
        where: " Jl. Sunset 1 ",
        notes: "Bring the budget",
        remind: "1d",
      }),
    ).toEqual({
      title: "Tasting at Sendok Emas",
      type: "appointment",
      startAt: "2026-10-16T10:00",
      endAt: null,
      allDay: false,
      location: "Jl. Sunset 1",
      notes: "Bring the budget",
      relatedVendorId: "v1",
      relatedVenueId: null,
      reminderMinutes: [1440],
    });
  });

  it("links a venue, or nothing", () => {
    const base = {
      title: "x",
      kind: "other" as const,
      when: { date: "2026-10-16", allDay: true, start: "", end: "" },
      where: "",
      notes: "",
      remind: "" as const,
    };
    expect(storedEvent({ ...base, related: "venue:vn1" })).toMatchObject({ relatedVendorId: null, relatedVenueId: "vn1" });
    expect(storedEvent({ ...base, related: "" })).toMatchObject({ relatedVendorId: null, relatedVenueId: null, reminderMinutes: [] });
  });

  it("reads the link and the kind back", () => {
    expect(relatedValue({ relatedVendorId: "v1", relatedVenueId: null })).toBe("vendor:v1");
    expect(relatedValue({ relatedVendorId: null, relatedVenueId: "vn1" })).toBe("venue:vn1");
    expect(relatedValue({ relatedVendorId: null, relatedVenueId: null })).toBe("");
    expect(kindOf("vendor_call")).toBe("vendor_call");
    expect(kindOf("something new")).toBe("other");
  });
});
