import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BudgetOverview } from "@/lib/data/use-budget";
import type { Booking } from "@/lib/model/bookings";
import { budget, dues } from "@/lib/model/money";
import { BudgetView } from "@/veil/screens/budget/budget-view";

// Task 4.3: the budget screen as markup (guide §5.4): the hero, the next card,
// the after line, the four doors, the closing line and the add button. The
// e2e tests in tests/e2e/ check it against the emulator and in demonstration mode.

/** The words on screen: the markup without its tags and React's comment markers. */
const words = (node: ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
const html = (node: ReactElement) => renderToStaticMarkup(node);

const TODAY = "2026-10-14";
const CK = { id: "ck", name: "CK" };
const GREGORY = { id: "greg", name: "Gregory" };
const onRecord = () => {};

function booking(id: string, name: string, extra: Partial<Booking>): Booking {
  return {
    id,
    kind: "vendor",
    recordId: id,
    name,
    category: "Catering",
    price: 0,
    paid: 0,
    funder: "ck",
    due: null,
    step: "",
    parts: [],
    estimate: null,
    bookedOn: null,
    from: "vendor",
    direct: false,
    ...extra,
  };
}

/** Part of the budget's view for these bookings, as the screen's read joins it. */
function viewOf(bookings: Booking[], over: Partial<BudgetOverview> = {}): BudgetOverview {
  return {
    today: TODAY,
    weddingDate: "2027-03-20",
    budget: budget(bookings),
    dues: dues(bookings, TODAY),
    funders: [CK, GREGORY],
    notAssignedLeft: 0,
    whatIfCount: 0,
    projectedTotal: 0,
    ...over,
  };
}

const CATERING = booking("vendor-catering", "Dapur Lestari Catering", {
  price: 30_000_000,
  paid: 10_000_000,
  due: "2026-10-28",
});

describe("BudgetView, booked", () => {
  it("shows what is still to pay, with the share paid as its thread", () => {
    const bookings = [CATERING];
    const page = html(<BudgetView view={viewOf(bookings, { projectedTotal: 30_000_000 })} onRecord={onRecord} />);
    expect(words(<BudgetView view={viewOf(bookings, { projectedTotal: 30_000_000 })} onRecord={onRecord} />)).toContain(
      "Still to pay",
    );
    expect(words(<BudgetView view={viewOf(bookings)} onRecord={onRecord} />)).toContain(
      "of Rp 30.000.000 committed, with Rp 10.000.000 already paid",
    );
    expect(page).toContain('aria-label="33% paid, 67% to go"');
  });

  it("shows the next payment with its amount and the one primary Record payment", () => {
    const text = words(<BudgetView view={viewOf([CATERING])} onRecord={onRecord} />);
    expect(text).toContain("Next to pay");
    expect(text).toContain("Dapur Lestari Catering");
    expect(text).toContain("due in 14 days");
    expect(text).toContain("Record payment");
  });

  it("shows the four doors with their summaries and where each leads", () => {
    const page = html(<BudgetView view={viewOf([CATERING], { whatIfCount: 0 })} onRecord={onRecord} />);
    expect(page).toContain('href="/new/budget/bookings"');
    expect(page).toContain('href="/new/budget/payments"');
    expect(page).toContain('href="/new/budget/who-pays"');
    expect(page).toContain('href="/new/budget/what-if"');
    const text = words(<BudgetView view={viewOf([CATERING])} onRecord={onRecord} />);
    expect(text).toContain("1 booking");
    expect(text).toContain("1 payment until October");
    expect(text).toContain("CK and Gregory");
    expect(text).toContain("None yet");
  });

  it("closes with the days until the wedding and offers Add booking", () => {
    const page = html(<BudgetView view={viewOf([CATERING])} onRecord={onRecord} />);
    expect(words(<BudgetView view={viewOf([CATERING])} onRecord={onRecord} />)).toContain(
      "157 days until Saturday 20 March 2027",
    );
    expect(page).toContain('href="/new/budget/bookings/new"');
  });

  it("says overpaid, with the amount over and the overpaid thread, when paid more than committed", () => {
    const over = booking("vendor-photo", "Lumina Photography", { price: 12_000_000, paid: 14_000_000 });
    const page = html(<BudgetView view={viewOf([over])} onRecord={onRecord} />);
    expect(words(<BudgetView view={viewOf([over])} onRecord={onRecord} />)).toContain("Overpaid by");
    expect(page).toContain('aria-label="100% paid, overpaid"');
    expect(words(<BudgetView view={viewOf([over])} onRecord={onRecord} />)).toContain(
      "Check the overpaid bookings.",
    );
  });
});

describe("BudgetView, nothing booked", () => {
  it("shows the empty layout with Add booking, Try a what-if item and the days line", () => {
    const view = viewOf([]);
    const text = words(<BudgetView view={view} onRecord={onRecord} />);
    expect(text).toContain("Nothing booked yet");
    expect(text).toContain("Add booking");
    expect(text).toContain("Try a what-if item");
    expect(text).toContain("157 days until Saturday 20 March 2027");
    expect(text).not.toContain("Still to pay");
  });

  it("leaves out Try a what-if item once there are what-if items", () => {
    const text = words(<BudgetView view={viewOf([], { whatIfCount: 2 })} onRecord={onRecord} />);
    expect(text).not.toContain("Try a what-if item");
  });
});

describe("BudgetView, demonstration mode", () => {
  it("shows the empty layout without any days line, since there is no wedding date to count", () => {
    const text = words(<BudgetView view={null} onRecord={onRecord} />);
    expect(text).toContain("Nothing booked yet");
    expect(text).toContain("Add booking");
    expect(text).not.toContain("days until");
    expect(text).not.toContain("Still to pay");
  });
});
