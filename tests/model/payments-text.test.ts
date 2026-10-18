import { describe, expect, it } from "vitest";
import type { Booking } from "@/lib/model/bookings";
import { dues as duesOf } from "@/lib/model/money";
import {
  countText,
  groupDues,
  headline,
  nothingBody,
  visibleGroups,
  type ContextPart,
} from "@/veil/screens/payments/payments-text";

// Task 4.8: the words and grouping of Payments due (guide §5.8). The screen takes
// the model's dues and groups them the way the prototype does.

const TODAY = "2026-10-14";

function booking(id: string, price: number, due: string | null, paid = 0): Booking {
  return {
    id: `vendor-${id}`,
    kind: "vendor",
    recordId: id,
    name: id,
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
  };
}

const LATE = booking("late", 4_000_000, "2026-10-10");
const SOON = booking("soon", 62_650_000, "2026-10-20");
const DEC = booking("dec", 1_000_000, "2026-12-05");
const DEC2 = booking("dec2", 2_000_000, "2026-12-20");
const JAN = booking("jan", 3_000_000, "2027-01-15");
const dues = (...list: Booking[]) => duesOf(list, TODAY);

/** The sentence under the figure as it reads, amounts marked with brackets. */
const sentence = (parts: ContextPart[]) => parts.map((p) => (typeof p === "string" ? p : `[${p.amount}]`)).join("");

describe("headline", () => {
  it("shows what is late, and what else is due in the next 14 days", () => {
    const top = headline(dues(LATE, SOON, DEC));
    expect(top).toMatchObject({ kicker: "Late, across 1 payment", amount: 4_000_000, late: true });
    expect(sentence(top.context)).toBe("and [62650000] more due in the next 14 days. In all, [67650000] across 3 payments.");
  });

  it("shows what is due soon when nothing is late", () => {
    const top = headline(dues(SOON, DEC));
    expect(top).toMatchObject({ kicker: "Due in the next 14 days", amount: 62_650_000, late: false });
    expect(sentence(top.context)).toBe("nothing is late. In all, [63650000] across 2 payments.");
  });

  it("shows everything on dated bookings when nothing is late or soon", () => {
    const top = headline(dues(DEC, JAN));
    expect(top).toMatchObject({ kicker: "Still to pay on dated bookings", amount: 4_000_000, late: false });
    expect(sentence(top.context)).toBe(
      "nothing is late or due in the next 14 days. In all, [4000000] across 2 payments.",
    );
  });

  it("counts only what is still owed", () => {
    const top = headline(dues(booking("part", 5_000_000, "2026-10-10", 3_000_000)));
    expect(top.amount).toBe(2_000_000);
  });
});

describe("groupDues", () => {
  it("makes Late, the next 14 days, then a group for each month, each with its total", () => {
    const groups = groupDues(dues(JAN, DEC2, SOON, LATE, DEC), TODAY);
    expect(groups.map((g) => [g.heading, g.total, g.dues.length, g.late])).toEqual([
      ["Late", 4_000_000, 1, true],
      ["In the next 14 days", 62_650_000, 1, false],
      ["December", 3_000_000, 2, false],
      ["January 2027", 3_000_000, 1, false],
    ]);
  });

  it("keeps the earliest first inside a group", () => {
    const [december] = groupDues(dues(DEC2, DEC), TODAY);
    expect(december.dues.map((d) => d.booking.name)).toEqual(["dec", "dec2"]);
  });

  it("makes no groups for no dues", () => {
    expect(groupDues([], TODAY)).toEqual([]);
  });
});

describe("visibleGroups", () => {
  const groups = groupDues(dues(LATE, SOON, DEC, DEC2, JAN), TODAY);
  const sizes = (shown: number) => visibleGroups(groups, shown).map((g) => g.dues.length);

  it("cuts the list at the number shown, across groups", () => {
    expect(sizes(3)).toEqual([1, 1, 1]);
    expect(sizes(4)).toEqual([1, 1, 2]);
  });

  it("drops a group with nothing left, and keeps a cut group's whole total", () => {
    expect(sizes(1)).toEqual([1]);
    expect(visibleGroups(groups, 3)[2].total).toBe(3_000_000);
  });

  it("shows everything when it all fits", () => {
    expect(sizes(60)).toEqual([1, 1, 2, 1]);
  });
});

describe("the words around the list", () => {
  it("counts only once the list pages", () => {
    expect(countText(1507, 60)).toBe("Showing 60 of 1.507");
    expect(countText(60, 60)).toBeNull();
  });

  it("says why nothing is due, depending on whether anything is booked", () => {
    expect(nothingBody(true)).toBe("Every booking with a due date is paid up. Bookings without a date don’t show here.");
    expect(nothingBody(false)).toBe("Once you have bookings with due dates, every unpaid amount shows here in date order.");
  });
});
