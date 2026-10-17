import { describe, expect, it } from "vitest";
import {
  NOTHING_SCHEDULED,
  SCHEDULE_SUB,
  STATUS_TOAST,
  addedToast,
  deleteConfirm,
  deletedToast,
  noResults,
  reminderBoxText,
  sheetSub,
} from "@/veil/screens/schedule/schedule-text";

const TODAY = "2026-10-14";

describe("the Schedule's words", () => {
  it("has the title's line and the empty state from the guide", () => {
    expect(SCHEDULE_SUB).toBe("Appointments, calls, payments and tasks, in one line of time");
    expect(NOTHING_SCHEDULED.title).toBe("Nothing scheduled yet");
    expect(NOTHING_SCHEDULED.body).toBe(
      "Add appointments, vendor calls and deadlines. Payments due on bookings and tasks with dates appear here by themselves.",
    );
  });

  it("says what a search or a kind that leaves nothing found", () => {
    expect(noResults("florist")).toEqual({
      title: "Nothing matches “florist”",
      body: "Search looks through titles, places and notes of everything with a date.",
    });
    expect(noResults("   ")).toEqual({ title: "Nothing here", body: "Nothing of this kind is coming up." });
  });

  it("names the reminders that can't arrive: three, then a count", () => {
    expect(reminderBoxText(["A"])).toMatchObject({
      lead: "1 reminder you set before can’t arrive, because reminders now come only in the morning:",
      shown: ["A"],
      rest: "",
      tail: ". Choose again for each.",
    });
    expect(reminderBoxText(["A", "B"]).lead).toMatch(/^2 reminders /);
    const many = reminderBoxText(["A", "B", "C", "D", "E"]);
    expect(many.shown).toEqual(["A", "B", "C"]);
    expect(many.rest).toBe(" and 2 more");
  });

  it("says when the event is, or was, or how it ended", () => {
    expect(sheetSub("scheduled", "2026-10-16", false, TODAY)).toBe("Friday 16 October");
    expect(sheetSub("scheduled", "2026-10-12", true, TODAY)).toBe("Was on Monday 12 October");
    expect(sheetSub("completed", "2026-10-12", false, TODAY)).toBe("Completed");
    expect(sheetSub("cancelled", "2026-10-12", false, TODAY)).toBe("Cancelled");
    expect(sheetSub("scheduled", null, false, TODAY)).toBe("");
  });

  it("has the toasts and the delete question", () => {
    expect(addedToast("Makeup trial")).toBe("Added Makeup trial");
    expect(deletedToast("Makeup trial")).toBe("Deleted Makeup trial");
    expect(STATUS_TOAST).toEqual({ completed: "Marked completed", cancelled: "Cancelled", scheduled: "Back to scheduled" });
    expect(deleteConfirm("Makeup trial")).toEqual({
      title: "Delete Makeup trial?",
      body: "It comes off the schedule for both of you. You can undo for a few seconds.",
      action: "Delete",
    });
  });
});
