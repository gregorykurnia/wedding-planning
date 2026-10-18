import { describe, expect, it } from "vitest";
import type { Booking, FunderId } from "@/lib/model/bookings";
import {
  NO_VENDOR_FILTER,
  NO_VENUE_FILTER,
  bookingMatches,
  filterVendors,
  filterVenues,
  fold,
  highlight,
  isFilteringVendors,
  isFilteringVenues,
  isListedVendor,
  matches,
} from "@/lib/model/search";

describe("matches", () => {
  it("matches everything when the search is empty", () => {
    expect(matches("", "anything")).toBe(true);
    expect(matches("   ", null)).toBe(true);
  });

  it("ignores case and accents", () => {
    expect(matches("lumiere", "Lumière Décor")).toBe(true);
    expect(matches("DÉCOR", "Lumiere Decor")).toBe(true);
    expect(fold("Crème Brûlée")).toBe("creme brulee");
  });

  it("looks in any of the fields, and skips blanks", () => {
    expect(matches("ubud", "Villa Samaya", null, "Ubud, Bali")).toBe(true);
    expect(matches("harpist", "Villa Samaya", undefined, "")).toBe(false);
  });

  it("works with non-Latin text", () => {
    expect(matches("摄影", "婚礼摄影工作室")).toBe(true);
    expect(matches("استوديو", "استوديو التصوير الفوتوغرافي للأعراس")).toBe(true);
    expect(matches("摄影", "Studio")).toBe(false);
  });
});

describe("highlight", () => {
  it("marks every match and keeps the rest as it was written", () => {
    expect(highlight("Tasting at Sendok Emas, tasting again", "tast")).toEqual([
      { text: "Tast", match: true },
      { text: "ing at Sendok Emas, ", match: false },
      { text: "tast", match: true },
      { text: "ing again", match: false },
    ]);
  });

  it("matches through accents and returns the original letters", () => {
    expect(highlight("Lumière Décor", "lumiere")).toEqual([
      { text: "Lumière", match: true },
      { text: " Décor", match: false },
    ]);
  });

  it("returns the whole text when there's no search or no match", () => {
    expect(highlight("Kebun Bunga", "")).toEqual([{ text: "Kebun Bunga", match: false }]);
    expect(highlight("Kebun Bunga", "zzz")).toEqual([{ text: "Kebun Bunga", match: false }]);
    expect(highlight("", "a")).toEqual([]);
  });

  it("handles CJK and emoji", () => {
    expect(highlight("婚礼摄影工作室", "摄影")).toEqual([
      { text: "婚礼", match: false },
      { text: "摄影", match: true },
      { text: "工作室", match: false },
    ]);
    expect(highlight("a😀b", "😀")).toEqual([
      { text: "a", match: false },
      { text: "😀", match: true },
      { text: "b", match: false },
    ]);
  });
});

const vendor = (over: Partial<Parameters<typeof filterVendors>[0][number]> = {}) => ({
  name: "Vendor",
  contactName: "",
  notes: "",
  category: "Food",
  starred: false,
  ...over,
});

describe("filterVendors", () => {
  const list = [
    vendor({ name: "Dapur Lestari", contactName: "Ibu Ratna", category: "Food", starred: true }),
    vendor({ name: "Rasa Nusantara", notes: "Fully booked on our date.", category: "Food" }),
    vendor({ name: "Studio Rana", contactName: "Rana", category: "Photos and Videos", starred: true }),
  ];
  const names = (f: Partial<typeof NO_VENDOR_FILTER>) => filterVendors(list, { ...NO_VENDOR_FILTER, ...f }).map((v) => v.name);

  it("searches names, contact people and notes", () => {
    expect(names({ query: "ratna" })).toEqual(["Dapur Lestari"]);
    expect(names({ query: "booked" })).toEqual(["Rasa Nusantara"]);
    expect(names({ query: "rana" })).toEqual(["Studio Rana"]);
    expect(names({ query: "harpist" })).toEqual([]);
  });

  it("narrows by category and by keen, together", () => {
    expect(names({ category: "Food" })).toEqual(["Dapur Lestari", "Rasa Nusantara"]);
    expect(names({ keen: true })).toEqual(["Dapur Lestari", "Studio Rana"]);
    expect(names({ category: "Food", keen: true })).toEqual(["Dapur Lestari"]);
    expect(names({ category: "Food", keen: true, query: "studio" })).toEqual([]);
  });

  it("knows when something is filtering", () => {
    expect(isFilteringVendors(NO_VENDOR_FILTER)).toBe(false);
    expect(isFilteringVendors({ ...NO_VENDOR_FILTER, keen: true })).toBe(true);
    expect(isFilteringVendors({ ...NO_VENDOR_FILTER, category: "Food" })).toBe(true);
  });

  it("leaves direct bookings out of the Vendors list", () => {
    expect(isListedVendor({})).toBe(true);
    expect(isListedVendor({ booking: null })).toBe(true);
    expect(isListedVendor({ booking: { from: "vendor" } })).toBe(true);
    expect(isListedVendor({ booking: { from: "direct" } })).toBe(false);
  });
});

const venue = (over = {}) => ({
  name: "Venue",
  location: "",
  notes: "",
  status: "Shortlist",
  budgetEstimate: 0,
  guestMax: 0,
  ...over,
});

describe("filterVenues", () => {
  const M = 1_000_000;
  const list = [
    venue({ name: "Villa Samaya Ubud", location: "Ubud, Bali", status: "Booked", budgetEstimate: 380 * M, guestMax: 450 }),
    venue({ name: "Puri Taman Sari", location: "Gianyar, Bali", status: "Toured", budgetEstimate: 340 * M, guestMax: 500 }),
    venue({ name: "Amara Cliff", location: "Uluwatu, Bali", status: "Shortlist", budgetEstimate: 450 * M, guestMax: 250, notes: "Sea view" }),
    venue({ name: "The Glasshouse", location: "Seminyak", status: "Rejected", budgetEstimate: 520 * M, guestMax: 300 }),
    venue({ name: "Unknown", status: "Shortlist" }),
  ];
  const names = (f: Partial<typeof NO_VENUE_FILTER>) => filterVenues(list, { ...NO_VENUE_FILTER, ...f }).map((v) => v.name);

  it("hides ruled-out venues by default", () => {
    expect(names({})).toEqual(["Villa Samaya Ubud", "Puri Taman Sari", "Amara Cliff", "Unknown"]);
    expect(names({ hideRuledOut: false })).toHaveLength(5);
  });

  it("searches names, places and notes", () => {
    expect(names({ query: "ubud" })).toEqual(["Villa Samaya Ubud"]);
    expect(names({ query: "gianyar" })).toEqual(["Puri Taman Sari"]);
    expect(names({ query: "sea view" })).toEqual(["Amara Cliff"]);
    expect(names({ query: "beach" })).toEqual([]);
  });

  it("filters by stage", () => {
    expect(names({ stage: "Toured" })).toEqual(["Puri Taman Sari"]);
    expect(names({ stage: "Rejected", hideRuledOut: false })).toEqual(["The Glasshouse"]);
    expect(names({ stage: "Rejected" })).toEqual([]);
  });

  it("filters by cost at most, leaving out venues with no cost", () => {
    expect(names({ maxCost: 380 * M })).toEqual(["Villa Samaya Ubud", "Puri Taman Sari"]);
    expect(names({ maxCost: 200 * M })).toEqual([]);
  });

  it("filters by guests held at least, leaving out venues with no capacity", () => {
    expect(names({ minGuests: 450 })).toEqual(["Villa Samaya Ubud", "Puri Taman Sari"]);
    expect(names({ minGuests: 1000 })).toEqual([]);
  });

  it("combines every filter", () => {
    expect(names({ maxCost: 400 * M, minGuests: 460 })).toEqual(["Puri Taman Sari"]);
    expect(names({ maxCost: 400 * M, minGuests: 460, query: "villa" })).toEqual([]);
  });

  it("handles a 13-digit cost and a 125.000-guest hall", () => {
    const big = venue({ name: "Gedung", budgetEstimate: 9_876_543 * M, guestMax: 125_000 });
    expect(filterVenues([big], { ...NO_VENUE_FILTER, maxCost: 9_876_543 * M })).toHaveLength(1);
    expect(filterVenues([big], { ...NO_VENUE_FILTER, minGuests: 125_001 })).toHaveLength(0);
  });

  it("knows when something beyond the default is filtering", () => {
    expect(isFilteringVenues(NO_VENUE_FILTER)).toBe(false);
    expect(isFilteringVenues({ ...NO_VENUE_FILTER, hideRuledOut: false })).toBe(true);
    expect(isFilteringVenues({ ...NO_VENUE_FILTER, maxCost: 0 })).toBe(true);
    expect(isFilteringVenues({ ...NO_VENUE_FILTER, minGuests: 100 })).toBe(true);
    expect(isFilteringVenues({ ...NO_VENUE_FILTER, stage: "Booked" })).toBe(true);
  });
});

describe("bookingMatches", () => {
  const NAMES: Record<string, string> = { greg: "Gregory", ck: "CK" };
  const nameOf = (id: FunderId) => (id === null ? "Not assigned" : (NAMES[id] ?? "Not assigned"));

  const booking = (extra: Partial<Booking>): Booking => ({
    id: "vendor-x",
    kind: "vendor",
    recordId: "x",
    name: "Lumière Décor",
    category: "Decoration",
    price: 10,
    paid: 0,
    funder: "greg",
    due: null,
    step: "Send the deposit",
    parts: [],
    estimate: null,
    bookedOn: null,
    from: "vendor",
    direct: false,
    ...extra,
  });

  it("matches everything when the search is empty", () => {
    expect(bookingMatches(booking({}), "", nameOf)).toBe(true);
  });

  it("looks through the name, the category, the parts' names and next steps, ignoring accents", () => {
    const parts = booking({
      parts: [{ id: "p", name: "Final payment", price: 5, paid: 0, funder: "ck", due: null, step: "Ask for the invoice" }],
    });
    expect(bookingMatches(parts, "lumiere", nameOf)).toBe(true);
    expect(bookingMatches(parts, "decor", nameOf)).toBe(true);
    expect(bookingMatches(parts, "final payment", nameOf)).toBe(true);
    expect(bookingMatches(parts, "invoice", nameOf)).toBe(true);
    expect(bookingMatches(parts, "fireworks", nameOf)).toBe(false);
  });

  it("looks through the funders' names, so a booking's funder can be searched", () => {
    expect(bookingMatches(booking({ funder: "greg" }), "gregory", nameOf)).toBe(true);
    expect(bookingMatches(booking({ funder: "greg" }), "CK", nameOf)).toBe(false);
  });

  it("finds a booking with no funder by Not assigned, as Who pays links it", () => {
    expect(bookingMatches(booking({ funder: null }), "not assigned", nameOf)).toBe(true);
    expect(bookingMatches(booking({ funder: "ck" }), "not assigned", nameOf)).toBe(false);
  });
});
