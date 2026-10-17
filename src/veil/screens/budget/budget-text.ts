import type { IsoDate } from "@/lib/model/bookings";
import { monthHeading, parseIso } from "@/lib/model/dates";
import { andList, n0, plural, rp } from "@/lib/model/format";
import type { Budget, Due, Funder } from "@/lib/model/money";
import type { SummaryPart } from "@/veil/parts/doors/doors";

/** Up to this many funders are named on the Who pays door; past it they are counted. */
const NAMED_FUNDERS = 4;

export const NOTHING_TITLE = "Nothing booked yet";
export const NOTHING_BODY =
  "When you choose a vendor or book a venue, it lands here as a booking with its price and payments. You can also add one yourself.";
export const ADD_BOOKING = "Add booking";
export const TRY_WHAT_IF = "Try a what-if item";

export interface HeroFigures {
  /** Overpaid: the figure is the amount over, drawn in rose. */
  over: boolean;
  kicker: string;
  /** Positive: what's still to pay, or the amount over when overpaid. */
  amount: number;
  /** The share paid, from 0 to 100. */
  pct: number;
  ends: [string, string];
  /** The thread's words for a screen reader: "33% paid, 67% to go". */
  label: string;
}

/** The hero's kicker, figure and thread for the budget (guide §5.4). */
export function heroFigures(b: Budget): HeroFigures {
  const over = b.left < 0;
  const pct = b.price ? Math.max(0, Math.min(100, Math.round((b.paid / b.price) * 100))) : 0;
  const rest = over ? "overpaid" : `${100 - pct}% to go`;
  return {
    over,
    kicker: over ? "Overpaid by" : "Still to pay",
    amount: Math.abs(b.left),
    pct,
    ends: [`${pct}% paid`, rest],
    label: `${pct}% paid, ${rest}`,
  };
}

/** What the four doors need to say, worked out from the model's numbers. */
export interface DoorFacts {
  budget: Budget;
  /** The dated payments still owed, earliest first (`dues()`). */
  dues: Pick<Due, "due" | "urgency">[];
  today: IsoDate;
  funders: Funder[];
  /** What Not assigned still has to pay. */
  notAssignedLeft: number;
  whatIfCount: number;
  /** The committed price plus every what-if item. */
  projectedTotal: number;
}

export interface DoorSummaries {
  bookings: SummaryPart[];
  payments: SummaryPart[];
  whoPays: SummaryPart[];
  whatIf: SummaryPart[];
}

/** The muted summary on each door, with an overpaid or late count in rose. */
export function doorSummaries(f: DoorFacts): DoorSummaries {
  return {
    bookings: bookingsSummary(f),
    payments: paymentsSummary(f),
    whoPays: whoPaysSummary(f),
    whatIf: whatIfSummary(f),
  };
}

function bookingsSummary({ budget }: DoorFacts): SummaryPart[] {
  const count = { text: plural(budget.count, "booking") };
  if (budget.overCount === 0) return [count];
  return [count, { text: ", " }, { text: `${n0(budget.overCount)} overpaid`, attention: true }];
}

function paymentsSummary({ dues, today }: DoorFacts): SummaryPart[] {
  if (dues.length === 0) return [{ text: "Nothing due" }];
  const late = dues.filter((d) => d.urgency === "late").length;
  const last = parseIso(dues[dues.length - 1].due);
  const until = last ? monthHeading(last.year, last.month, today) : "";
  const count = { text: `${plural(dues.length, "payment")} until ${until}` };
  if (late === 0) return [count];
  return [{ text: `${n0(late)} late`, attention: true }, { text: ", " }, count];
}

function whoPaysSummary({ funders, notAssignedLeft }: DoorFacts): SummaryPart[] {
  const names =
    funders.length <= NAMED_FUNDERS ? andList(funders.map((f) => f.name)) : plural(funders.length, "funder");
  const unassigned = notAssignedLeft > 0 ? `${rp(notAssignedLeft)} not assigned` : "";
  return [{ text: [names, unassigned].filter(Boolean).join(", ") }];
}

function whatIfSummary({ whatIfCount, projectedTotal }: DoorFacts): SummaryPart[] {
  if (whatIfCount === 0) return [{ text: "None yet" }];
  return [{ text: `Would bring the total to ${rp(projectedTotal)}` }];
}
