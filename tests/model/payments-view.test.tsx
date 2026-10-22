import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Booking, Part } from "@/lib/model/bookings";
import { dues as duesOf } from "@/lib/model/money";
import { PaymentsView, type PaymentsList } from "@/veil/screens/payments/payments-view";
import { FlashProvider } from "@/veil/shell/flash";

// Task 4.8: the Payments due screen as markup (guide §5.8): the figure and its
// sentence, the groups with their totals, the rows, the paging and the empty
// layouts. The e2e tests check it against the emulator and in demonstration mode.

const words = (node: ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
const html = (node: ReactElement) => renderToStaticMarkup(node);

const TODAY = "2026-10-14";
const CK = { id: "ck", name: "CK" };

function booking(id: string, price: number, due: string | null, extra: Partial<Booking> = {}): Booking {
  return {
    id: `vendor-${id}`,
    kind: "vendor",
    recordId: id,
    name: id,
    category: "Catering",
    price,
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

const listOf = (bookings: Booking[], hasBookings = true): PaymentsList => ({
  today: TODAY,
  dues: duesOf(bookings, TODAY),
  funders: [CK],
  hasBookings,
});

/** The screen as the app draws it: inside the flash provider its rows need. */
const page = (list: PaymentsList | null) => (
  <FlashProvider>
    <PaymentsView list={list} onRecord={() => {}} />
  </FlashProvider>
);

const LATE = booking("Dapur Lestari Catering", 4_000_000, "2026-10-10", { step: "Pay the balance" });
const SOON = booking("Bunga Melati Florist", 5_000_000, "2026-10-20");

describe("the empty layouts", () => {
  it("says nothing is due when every dated booking is paid, with See bookings", () => {
    const view = page(listOf([booking("paid", 1000, "2026-10-10", { paid: 1000 })]));
    expect(words(view)).toContain("Nothing to pay right now");
    expect(words(view)).toContain("Every booking with a due date is paid up.");
    expect(html(view)).toContain('href="/budget/bookings"');
  });

  it("says something different when nothing is booked at all", () => {
    expect(words(page(listOf([], false)))).toContain("Once you have bookings with due dates");
  });

  it("shows the no-bookings layout in demonstration mode", () => {
    const view = page(null);
    expect(words(view)).toContain("Nothing to pay right now");
    expect(words(view)).toContain("Once you have bookings with due dates");
  });
});

describe("the list", () => {
  it("shows what's late in the hero, rose, with a Late group first", () => {
    const view = page(listOf([SOON, LATE]));
    expect(words(view)).toContain("Late, across 1 payment");
    expect(words(view)).toContain("and Rp 5.000.000 more due in the next 14 days. In all, Rp 9.000.000 across 2 payments.");
    const markup = html(view);
    expect(markup).toContain('<h2');
    expect(markup.indexOf("Late</span>")).toBeLessThan(markup.indexOf("In the next 14 days"));
  });

  it("has a screen-reader title, since the figure hero shows none", () => {
    expect(html(page(listOf([LATE])))).toContain('<h1 class="sr">Payments due</h1>');
  });

  it("links each row to its booking and offers Record payment", () => {
    const view = page(listOf([LATE]));
    expect(html(view)).toContain('href="/budget/bookings/vendor-Dapur%20Lestari%20Catering"');
    expect(words(view)).toContain("Record payment");
    expect(words(view)).toContain("4 days late");
  });

  it("names the part of a booking in parts, and its step", () => {
    const part = (n: number, due: string): Part => ({
      id: `p${n}`,
      name: `Stage ${n}`,
      price: 1000,
      paid: 0,
      funder: "ck",
      due,
      step: `Step ${n}`,
    });
    const split = booking("Pelaminan Ayu", 2000, null, { parts: [part(1, "2026-10-20"), part(2, "2026-12-01")] });
    const view = page(listOf([split]));
    expect(words(view)).toContain("Pelaminan Ayu, stage 1");
    expect(words(view)).toContain("Step 2");
    expect(words(view)).toContain("December");
  });

  it("shows 60 at a time, with the count and Show more for the rest", () => {
    const many = Array.from({ length: 61 }, (_, i) => booking(`b${i}`, 1000, "2026-12-05"));
    const view = page(listOf(many));
    expect(html(view).match(/data-booking-id=/g)).toHaveLength(60);
    expect(words(view)).toContain("Showing 60 of 61");
    expect(words(view)).toContain("Show 1 more");
  });

  it("shows no count when everything fits", () => {
    expect(words(page(listOf([LATE])))).not.toContain("Showing");
  });
});
