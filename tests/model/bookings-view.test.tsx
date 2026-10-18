import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BookingList } from "@/lib/data/use-booking-list";
import type { Booking, Part } from "@/lib/model/bookings";
import { budget } from "@/lib/model/money";
import { BookingsView } from "@/veil/screens/bookings/bookings-view";
import { FlashProvider } from "@/veil/shell/flash";

// Task 4.5: the Bookings screen as markup (guide §5.5): the title and the committed
// line, the search and the order, the ledger with each booking's parts, the paging,
// and the empty layouts. The e2e tests check it against the emulator and in demonstration mode.

/** The words on screen: the markup without its tags and React's comment markers. */
const words = (node: ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
const html = (node: ReactElement) => renderToStaticMarkup(node);

/** The screen as the app draws it: inside the flash provider its rows need. */
const page = (list: BookingList | null, initialQuery = "") => (
  <FlashProvider>
    <BookingsView list={list} initialQuery={initialQuery} />
  </FlashProvider>
);

const TODAY = "2026-10-14";
const CK = { id: "ck", name: "CK" };
const GREGORY = { id: "greg", name: "Gregory" };

function booking(id: string, name: string, extra: Partial<Booking> = {}): Booking {
  return {
    id: `vendor-${id}`,
    kind: "vendor",
    recordId: id,
    name,
    category: "Catering",
    price: 0,
    paid: 0,
    funder: null,
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

function listOf(bookings: Booking[]): BookingList {
  return { today: TODAY, bookings, committed: budget(bookings), funders: [CK, GREGORY] };
}

const DAPUR = booking("dapur", "Dapur Lestari Catering", {
  price: 30_000_000,
  paid: 10_000_000,
  funder: "ck",
  due: "2026-10-10",
  step: "Pay the balance",
});
const BUNGA = booking("bunga", "Bunga Melati Florist", { price: 5_000_000, funder: "greg" });

describe("the empty layouts", () => {
  it("shows nothing booked, with Add booking, and no search or order", () => {
    const view = page(listOf([]));
    expect(words(view)).toContain("Nothing booked yet");
    expect(words(view)).toContain("Everything you’ve committed to");
    expect(html(view)).toContain('href="/new/budget/bookings/new"');
    expect(html(view)).not.toContain('type="search"');
  });

  it("shows the same empty layout in demonstration mode, where nothing is booked", () => {
    const view = page(null);
    expect(words(view)).toContain("Nothing booked yet");
    expect(words(view)).toContain("Everything you’ve committed to");
  });
});

describe("the list", () => {
  it("says what's committed, and lists the bookings with the next due first", () => {
    const view = page(listOf([BUNGA, DAPUR]));
    expect(words(view)).toContain("Bookings");
    expect(words(view)).toContain("2 bookings, Rp 35.000.000 committed");
    const markup = html(view);
    expect(markup.indexOf("Dapur Lestari Catering")).toBeLessThan(markup.indexOf("Bunga Melati Florist"));
  });

  it("gives every booking its status on the right: late, or left to pay", () => {
    const view = page(listOf([DAPUR, BUNGA]));
    expect(words(view)).toContain("Rp 20.000.000 late");
    expect(words(view)).toContain("Rp 5.000.000 to pay");
  });

  it("offers the nine orders in the select", () => {
    const markup = html(page(listOf([DAPUR])));
    for (const label of ["Next due date", "Still to pay", "Difference from estimate", "Date booked"]) {
      expect(markup).toContain(label);
    }
  });

  it("shows 100 at a time, with the count and Show more for the rest", () => {
    const many = Array.from({ length: 101 }, (_, i) =>
      booking(`b${i}`, `Booking ${String(i).padStart(3, "0")}`, { price: 1000 }),
    );
    const view = page(listOf(many));
    expect(html(view).match(/data-booking-id=/g)).toHaveLength(100);
    expect(words(view)).toContain("Showing 100 of 101");
    expect(words(view)).toContain("Show 1 more");
  });

  it("collapses a booking with more than five parts to four still owing, and counts the rest", () => {
    const part = (n: number): Part => ({ id: `p${n}`, name: `Part ${n}`, price: 10, paid: 0, funder: null, due: null, step: "" });
    const split = booking("split", "Pelaminan Ayu", { parts: [1, 2, 3, 4, 5, 6].map(part) });
    const view = page(listOf([split]));
    expect(html(view)).toContain("Part 4");
    expect(html(view)).not.toContain("Part 5");
    expect(words(view)).toContain("and 2 more parts");
  });

  it("links back to the budget, and floats Add booking under the list", () => {
    const markup = html(page(listOf([DAPUR])));
    expect(markup).toContain('href="/new/budget"');
    expect(markup).toContain('href="/new/budget/bookings/new"');
  });
});

describe("the search", () => {
  it("starts from the search it opens with, and counts what matches", () => {
    const loose = booking("loose", "Harmoni String Quartet", { price: 2_000_000, funder: null });
    const view = page(listOf([DAPUR, loose]), "Not assigned");
    expect(words(view)).toContain("1 booking matches");
    expect(html(view)).toContain("Harmoni String Quartet");
    expect(html(view)).not.toContain("Dapur Lestari Catering");
  });

  it("says no bookings match, quotes the search, and offers Clear the search, with the search kept", () => {
    const view = page(listOf([DAPUR, BUNGA]), "fireworks");
    expect(words(view)).toContain("No bookings match “fireworks”");
    expect(words(view)).toContain("Search looks through names, categories, parts, next steps and funders.");
    expect(words(view)).toContain("Clear the search");
    expect(html(view)).toContain('type="search"');
    expect(html(view)).not.toContain("data-booking-id");
  });
});
