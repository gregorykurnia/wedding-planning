import { describe, expect, it } from "vitest";
import type { Booking, Part } from "@/lib/model/bookings";
import { dues, type Funder } from "@/lib/model/money";
import {
  bookingHref,
  flagText,
  metaText,
  nextLabel,
  paidByText,
  titleText,
} from "@/veil/parts/next-card/next-text";

// Task 3.2: the words of the next card and its after line (guide §4.5), read
// without rendering. 2026-10-14 is a Wednesday. The markup is in next-components.test.tsx.

const TODAY = "2026-10-14";

const FUNDERS: Funder[] = [
  { id: "ck", name: "CK" },
  { id: "greg", name: "Gregory" },
];

function booking(due: string | null, extra: Partial<Booking> = {}): Booking {
  return {
    id: "vendor-1",
    kind: "vendor",
    recordId: "1",
    name: "Dapur Lestari Catering",
    category: "Catering",
    price: 1_000_000,
    paid: 0,
    funder: "ck",
    due,
    step: "",
    parts: [],
    estimate: null,
    bookedOn: null,
    from: "vendor",
    direct: false,
    ...extra,
  };
}

/** The due the model gives for one booking, as the screen would read it. */
function dueFor(...bookings: Booking[]) {
  const [first] = dues(bookings, TODAY);
  if (!first) throw new Error("expected a due");
  return first;
}

const part = (id: string, name: string, price: number, paid: number, due: string): Part => ({
  id,
  name,
  price,
  paid,
  funder: "greg",
  due,
  step: "",
});

describe("nextLabel", () => {
  it("is plain when nothing is late, or when only one is", () => {
    expect(nextLabel(0)).toBe("Next to pay");
    expect(nextLabel(1)).toBe("Next to pay");
  });

  it("counts the late payments from two up", () => {
    expect(nextLabel(3)).toBe("Next to pay, 1 of 3 late");
  });
});

describe("flagText", () => {
  it("says how late a late payment is", () => {
    expect(flagText(dueFor(booking("2026-10-09")), TODAY)).toBe("5 days late");
    expect(flagText(dueFor(booking("2026-10-13")), TODAY)).toBe("1 day late");
  });

  it("counts down inside 14 days, from today to a fortnight", () => {
    expect(flagText(dueFor(booking("2026-10-14")), TODAY)).toBe("due today");
    expect(flagText(dueFor(booking("2026-10-15")), TODAY)).toBe("due tomorrow");
    expect(flagText(dueFor(booking("2026-10-18")), TODAY)).toBe("due in 4 days");
    expect(flagText(dueFor(booking("2026-10-28")), TODAY)).toBe("due in 14 days");
  });

  it("turns to the short date after 14 days, with the year only when it isn't this year", () => {
    expect(flagText(dueFor(booking("2026-10-29")), TODAY)).toBe("29 Oct");
    expect(flagText(dueFor(booking("2027-12-02")), TODAY)).toBe("2 Dec 2027");
  });
});

describe("paidByText", () => {
  it("says who pays, or that nobody is named yet", () => {
    expect(paidByText(null, FUNDERS)).toBe("no funder yet");
    expect(paidByText("ck", FUNDERS)).toBe("paid by CK");
  });

  it("reads Not assigned for a funder that is no longer listed", () => {
    expect(paidByText("removed", FUNDERS)).toBe("paid by Not assigned");
  });
});

describe("titleText", () => {
  it("is the booking's name when the booking has no parts", () => {
    expect(titleText(dueFor(booking("2026-10-09")))).toBe("Dapur Lestari Catering");
  });

  it("adds the part's name in lower case when the booking has parts", () => {
    const withParts = booking("2026-10-20", {
      parts: [part("final", "Final payment", 15_000_000, 0, "2026-10-20")],
    });
    expect(titleText(dueFor(withParts))).toBe("Dapur Lestari Catering, final payment");
  });
});

describe("metaText", () => {
  it("names the category, the payer and the day it was due, when late", () => {
    expect(metaText(dueFor(booking("2026-10-09")), TODAY, FUNDERS)).toBe(
      "Catering, paid by CK, was due Friday 9 October",
    );
  });

  it("says due, not was due, when it isn't late yet", () => {
    expect(metaText(dueFor(booking("2026-12-02")), TODAY, FUNDERS)).toBe(
      "Catering, paid by CK, due Wednesday 2 December",
    );
  });

  it("fills in a missing category and a missing funder", () => {
    const bare = booking("2026-12-02", { category: "", funder: null });
    expect(metaText(dueFor(bare), TODAY, FUNDERS)).toBe(
      "No category, no funder yet, due Wednesday 2 December",
    );
  });
});

describe("bookingHref", () => {
  it("is the booking's page in the new UI", () => {
    expect(bookingHref("vendor-1")).toBe("/new/budget/bookings/vendor-1");
  });

  it("encodes the id, so an id with a space still works as an address", () => {
    expect(bookingHref("venue-a b")).toBe("/new/budget/bookings/venue-a%20b");
  });
});
