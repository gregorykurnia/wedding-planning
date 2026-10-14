import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  dateLong,
  dateShort,
  dayTitle,
  daysInMonth,
  daysUntil,
  dueText,
  editedText,
  isIsoDate,
  localIso,
  monthHeading,
  parseIso,
  timeGone,
  toIso,
  wasDueText,
  weekday,
} from "@/lib/model/dates";

const TODAY = "2026-10-14"; // a Wednesday

describe("parsing", () => {
  it("reads real calendar dates only", () => {
    expect(parseIso("2026-10-14")).toEqual({ year: 2026, month: 10, day: 14 });
    expect(parseIso("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseIso("2026-02-29")).toBeNull();
    expect(parseIso("2026-02-30")).toBeNull();
    expect(parseIso("2026-13-01")).toBeNull();
    expect(parseIso("2026-00-10")).toBeNull();
    expect(parseIso("2026-10-14T10:00")).toBeNull();
    expect(parseIso("soon")).toBeNull();
    expect(parseIso("")).toBeNull();
    expect(parseIso(null)).toBeNull();
    expect(isIsoDate("2026-10-14")).toBe(true);
    expect(isIsoDate("2026-10-41")).toBe(false);
  });

  it("builds dates with leading zeros", () => {
    expect(toIso(2026, 3, 5)).toBe("2026-03-05");
    expect(toIso(999, 1, 1)).toBe("0999-01-01");
  });

  it("takes the calendar day in the local zone, never shifted to UTC", () => {
    expect(localIso(new Date(2026, 9, 14, 0, 5))).toBe("2026-10-14");
    expect(localIso(new Date(2026, 9, 14, 23, 59))).toBe("2026-10-14");
    expect(localIso(new Date(2026, 11, 31, 23, 30))).toBe("2026-12-31");
    expect(localIso(new Date(2027, 0, 1, 0, 0))).toBe("2027-01-01");
  });
});

describe("arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-14", 1)).toBe("2026-10-15");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-10-14", -14)).toBe("2026-09-30");
    expect(addDays("nonsense", 3)).toBe("nonsense");
  });

  it("moves between months", () => {
    expect(addMonths(2026, 10, 1)).toEqual({ year: 2026, month: 11 });
    expect(addMonths(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths(2026, 3, -15)).toEqual({ year: 2024, month: 12 });
    expect(addMonths(2026, 3, 0)).toEqual({ year: 2026, month: 3 });
  });

  it("knows how long each month is", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("finds the weekday, with Sunday as 0", () => {
    expect(weekday("2026-10-14")).toBe(3);
    expect(weekday("2026-11-01")).toBe(0);
    expect(weekday("2027-03-20")).toBe(6);
  });

  it("counts whole days to a date", () => {
    expect(daysUntil("2026-10-14", TODAY)).toBe(0);
    expect(daysUntil("2026-10-15", TODAY)).toBe(1);
    expect(daysUntil("2026-10-11", TODAY)).toBe(-3);
    expect(daysUntil("2027-03-20", TODAY)).toBe(157);
  });
});

describe("long and short dates", () => {
  it("shows the year only when it isn't this year", () => {
    expect(dateLong("2026-10-14", TODAY)).toBe("Wednesday 14 October");
    expect(dateLong("2027-03-20", TODAY)).toBe("Saturday 20 March 2027");
    expect(dateLong("2025-12-31", TODAY)).toBe("Wednesday 31 December 2025");
    expect(dateShort("2026-10-14", TODAY)).toBe("14 Oct");
    expect(dateShort("2027-03-20", TODAY)).toBe("20 Mar 2027");
    expect(dateShort("2026-09-29", TODAY)).toBe("29 Sep");
    expect(monthHeading(2026, 10, TODAY)).toBe("October");
    expect(monthHeading(2027, 3, TODAY)).toBe("March 2027");
  });

  it("gives nothing for a date that isn't one", () => {
    expect(dateLong("", TODAY)).toBe("");
    expect(dateShort("2026-02-30", TODAY)).toBe("");
  });

  it("treats the new year as a new 'this year'", () => {
    expect(dateLong("2027-01-05", "2027-01-01")).toBe("Tuesday 5 January");
    expect(dateLong("2026-12-31", "2027-01-01")).toBe("Thursday 31 December 2026");
  });
});

describe("due text", () => {
  it("says how late, or when it falls due", () => {
    expect(dueText("2026-10-11", TODAY)).toBe("3 days late");
    expect(dueText("2026-10-13", TODAY)).toBe("1 day late");
    expect(dueText("2026-10-14", TODAY)).toBe("due today");
    expect(dueText("2026-10-15", TODAY)).toBe("due tomorrow");
    expect(dueText("2026-10-18", TODAY)).toBe("due in 4 days");
    expect(dueText("2026-10-28", TODAY)).toBe("due in 14 days");
    expect(dueText("2026-10-29", TODAY)).toBe("due Thursday 29 October");
    expect(dueText("2026-10-30", TODAY)).toBe("due Friday 30 October");
    expect(dueText("2027-03-20", TODAY)).toBe("due Saturday 20 March 2027");
  });

  it("groups a long lateness with dots", () => {
    expect(dueText("2023-01-01", TODAY)).toBe("1.382 days late");
  });

  it("has a past form for sentences", () => {
    expect(wasDueText("2026-10-12", TODAY)).toBe("was due Monday 12 October");
  });
});

describe("agenda day titles", () => {
  it("names today and tomorrow", () => {
    expect(dayTitle("2026-10-14", TODAY)).toBe("Today, Wednesday 14 October");
    expect(dayTitle("2026-10-15", TODAY)).toBe("Tomorrow, Thursday 15 October");
    expect(dayTitle("2026-10-16", TODAY)).toBe("Friday 16 October");
    expect(dayTitle("2026-10-13", TODAY)).toBe("Tuesday 13 October");
    expect(dayTitle("2027-03-20", TODAY)).toBe("Saturday 20 March 2027");
  });
});

describe("time gone", () => {
  it("counts the share of the time since the planner was set up", () => {
    expect(timeGone("2026-03-01", "2027-03-20", "2026-10-14")).toEqual({ elapsed: 227, total: 384, percent: 59 });
  });

  it("stays between 0 and 100", () => {
    expect(timeGone("2026-03-01", "2027-03-20", "2026-01-01")?.percent).toBe(0);
    expect(timeGone("2026-03-01", "2027-03-20", "2028-01-01")?.percent).toBe(100);
    expect(timeGone("2026-03-01", "2027-03-20", "2026-03-01")?.percent).toBe(0);
    expect(timeGone("2026-03-01", "2027-03-20", "2027-03-20")?.percent).toBe(100);
  });

  it("reads as all gone when the wedding is on or before the start", () => {
    expect(timeGone("2026-10-14", "2026-10-14", "2026-10-14")?.percent).toBe(100);
    expect(timeGone("2026-10-14", "2026-09-01", "2026-10-14")?.percent).toBe(100);
  });

  it("is nothing until both dates are known", () => {
    expect(timeGone(null, "2027-03-20", TODAY)).toBeNull();
    expect(timeGone("2026-03-01", null, TODAY)).toBeNull();
    expect(timeGone("junk", "2027-03-20", TODAY)).toBeNull();
  });
});

describe("edited text", () => {
  // These times are built in the local zone, which is the zone the function reads them in.
  const now = new Date(2026, 9, 14, 11, 30).getTime();
  const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi).getTime();

  it("says just now, then minutes, then hours", () => {
    expect(editedText(now, now)).toBe("just now");
    expect(editedText(now - 30_000, now)).toBe("just now");
    expect(editedText(now - 12 * 60_000, now)).toBe("12 min ago");
    expect(editedText(now - 59 * 60_000, now)).toBe("59 min ago");
    expect(editedText(at(2026, 10, 14, 10, 30), now)).toBe("1 hour ago");
    expect(editedText(at(2026, 10, 14, 9, 30), now)).toBe("2 hours ago");
    expect(editedText(at(2026, 10, 14, 0, 10), now)).toBe("11 hours ago");
  });

  it("says yesterday for anything yesterday, even late at night", () => {
    expect(editedText(at(2026, 10, 13, 23, 50), now)).toBe("yesterday");
    expect(editedText(at(2026, 10, 13, 6, 0), now)).toBe("yesterday");
  });

  it("falls back to the short date, with the year when it isn't this year", () => {
    expect(editedText(at(2026, 10, 12, 21, 15), now)).toBe("12 Oct");
    expect(editedText(at(2026, 9, 29, 19, 20), now)).toBe("29 Sep");
    expect(editedText(at(2025, 12, 31, 12, 0), now)).toBe("31 Dec 2025");
  });

  it("measures yesterday across a month end", () => {
    const first = new Date(2026, 10, 1, 8, 0).getTime();
    expect(editedText(at(2026, 10, 31, 22, 0), first)).toBe("yesterday");
  });

  it("adds who it was when it was the partner", () => {
    expect(editedText(now - 5_000, now, "Bella")).toBe("just now by Bella");
    expect(editedText(now - 12 * 60_000, now, "Bella")).toBe("12 min ago by Bella");
    expect(editedText(at(2026, 10, 14, 9, 30), now, "Bella")).toBe("2 hours ago by Bella");
    expect(editedText(at(2026, 10, 13, 9, 30), now, "Bella")).toBe("yesterday by Bella");
    expect(editedText(at(2026, 9, 29, 19, 20), now, "Bella")).toBe("29 Sep by Bella");
    expect(editedText(now - 12 * 60_000, now, null)).toBe("12 min ago");
    expect(editedText(now - 12 * 60_000, now, "")).toBe("12 min ago");
  });

  it("reads a write that hasn't been stamped yet, or a clock a little ahead, as just now", () => {
    expect(editedText(null, now)).toBe("just now");
    expect(editedText(undefined, now, "Bella")).toBe("just now by Bella");
    expect(editedText(now + 5 * 60_000, now)).toBe("just now");
  });
});
