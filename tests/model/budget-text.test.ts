import { describe, expect, it } from "vitest";
import type { Budget } from "@/lib/model/money";
import type { SummaryPart } from "@/veil/parts/doors/doors";
import { doorSummaries, heroFigures, type DoorFacts } from "@/veil/screens/budget/budget-text";

// Task 4.3: the budget's words and figures (guide §5.4). The screen takes the
// model's numbers and says them the way the prototype does.

const TODAY = "2026-10-14";

const budget = (over: Partial<Budget> = {}): Budget => ({
  count: 0,
  price: 0,
  paid: 0,
  left: 0,
  over: false,
  overBy: 0,
  overCount: 0,
  ...over,
});

/** The words of some summary pieces, and the pieces marked for attention. */
const text = (parts: SummaryPart[]) => parts.map((p) => p.text).join("");
const attention = (parts: SummaryPart[]) => parts.filter((p) => p.attention).map((p) => p.text);

const FACTS: DoorFacts = {
  budget: budget({ count: 1 }),
  dues: [],
  today: TODAY,
  funders: [],
  notAssignedLeft: 0,
  whatIfCount: 0,
  projectedTotal: 0,
};
const facts = (over: Partial<DoorFacts>): DoorFacts => ({ ...FACTS, ...over });

describe("heroFigures", () => {
  it("shows what is still to pay and the share paid", () => {
    expect(heroFigures(budget({ price: 30_000_000, paid: 10_000_000, left: 20_000_000 }))).toEqual({
      over: false,
      kicker: "Still to pay",
      amount: 20_000_000,
      pct: 33,
      ends: ["33% paid", "67% to go"],
      label: "33% paid, 67% to go",
    });
  });

  it("shows the amount over, in the overpaid words, when paid more than committed", () => {
    expect(
      heroFigures(budget({ price: 12_000_000, paid: 14_000_000, left: -2_000_000, over: true, overBy: 2_000_000 })),
    ).toEqual({
      over: true,
      kicker: "Overpaid by",
      amount: 2_000_000,
      pct: 100,
      ends: ["100% paid", "overpaid"],
      label: "100% paid, overpaid",
    });
  });

  it("reads a budget with no price as nothing paid", () => {
    const figures = heroFigures(budget());
    expect(figures.pct).toBe(0);
    expect(figures.ends).toEqual(["0% paid", "100% to go"]);
  });
});

describe("doorSummaries: bookings", () => {
  it("counts the bookings", () => {
    expect(text(doorSummaries(facts({ budget: budget({ count: 3 }) })).bookings)).toBe("3 bookings");
  });

  it("names the overpaid ones in rose, with the count in words", () => {
    const parts = doorSummaries(facts({ budget: budget({ count: 1206, overCount: 2 }) })).bookings;
    expect(text(parts)).toBe("1.206 bookings, 2 overpaid");
    expect(attention(parts)).toEqual(["2 overpaid"]);
  });
});

describe("doorSummaries: payments due", () => {
  it("says nothing is due when no dated payment is owed", () => {
    const parts = doorSummaries(facts({ dues: [] })).payments;
    expect(text(parts)).toBe("Nothing due");
    expect(attention(parts)).toEqual([]);
  });

  it("counts the payments until the month of the last one, with the late ones in rose", () => {
    const parts = doorSummaries(
      facts({
        dues: [
          { urgency: "late", due: "2026-10-01" },
          { urgency: "soon", due: "2026-10-20" },
          { urgency: "later", due: "2026-10-30" },
        ],
      }),
    ).payments;
    expect(text(parts)).toBe("1 late, 3 payments until October");
    expect(attention(parts)).toEqual(["1 late"]);
  });

  it("gives the year with the month when the last payment is in another year", () => {
    const parts = doorSummaries(
      facts({
        dues: [
          { urgency: "later", due: "2026-10-30" },
          { urgency: "later", due: "2027-03-05" },
        ],
      }),
    ).payments;
    expect(text(parts)).toBe("2 payments until March 2027");
  });
});

describe("doorSummaries: who pays", () => {
  const CK = { id: "ck", name: "CK" };
  const GREGORY = { id: "greg", name: "Gregory" };

  it("names up to four funders", () => {
    expect(text(doorSummaries(facts({ funders: [CK, GREGORY] })).whoPays)).toBe("CK and Gregory");
  });

  it("counts the funders past four", () => {
    const five = ["A", "B", "C", "D", "E"].map((name) => ({ id: name, name }));
    expect(text(doorSummaries(facts({ funders: five })).whoPays)).toBe("5 funders");
  });

  it("adds what is not assigned yet", () => {
    expect(text(doorSummaries(facts({ funders: [CK, GREGORY], notAssignedLeft: 5_000_000 })).whoPays)).toBe(
      "CK and Gregory, Rp 5.000.000 not assigned",
    );
  });

  it("does not start with a comma when there are no funders", () => {
    expect(text(doorSummaries(facts({ funders: [], notAssignedLeft: 5_000_000 })).whoPays)).toBe(
      "Rp 5.000.000 not assigned",
    );
  });
});

describe("doorSummaries: what-if items", () => {
  it("says none yet without items", () => {
    expect(text(doorSummaries(facts({ whatIfCount: 0 })).whatIf)).toBe("None yet");
  });

  it("says what the items would bring the total to", () => {
    expect(text(doorSummaries(facts({ whatIfCount: 2, projectedTotal: 45_000_000 })).whatIf)).toBe(
      "Would bring the total to Rp 45.000.000",
    );
  });
});
