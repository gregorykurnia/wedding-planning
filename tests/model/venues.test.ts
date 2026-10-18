import { describe, expect, it } from "vitest";
import type { Direction, VenueOrderKey } from "@/lib/model/order";
import { NO_VENUE_FILTER, type VenueFilter } from "@/lib/model/search";
import {
  CAPACITY_UNKNOWN,
  NOTE_CUT,
  bookedVenues,
  capacityOf,
  capacityText,
  costOf,
  countText,
  guestsMessage,
  noResultsBody,
  noteOnRow,
  readGuestFilter,
  readGuests,
  removeVenueBody,
  venueListItem,
  venueView,
  venuesSub,
  type VenueExtras,
  type VenueSource,
} from "@/lib/model/venues";

// Task 4.15: the Venues list's pure parts (guide §5.15): a stored venue as a row,
// the list in view, the words of the count line and the empty states, and how
// "Most guests" is read.

const source = (over: Partial<VenueSource> = {}): VenueSource => ({
  id: "ven1",
  name: "Villa Samaya Ubud",
  status: "Toured",
  location: "Ubud, Bali",
  notes: "",
  budgetEstimate: 250_000_000,
  guestMax: 300,
  ...over,
});

const extras: VenueExtras = { booked: false, fileCount: 0 };
const item = (over: Partial<VenueSource> = {}, more: Partial<VenueExtras> = {}) => venueListItem(source(over), { ...extras, ...more });

const view = (
  venues: ReturnType<typeof item>[],
  filter: Partial<VenueFilter> = {},
  order: { key: VenueOrderKey; direction: Direction } = { key: "cost", direction: "asc" },
  shown = 60,
) =>
  venueView(venues, { ...NO_VENUE_FILTER, ...filter }, order, shown, 60);

describe("a venue as a row", () => {
  it("keeps the stored names the filters and orders read, and adds whether it is booked and its files", () => {
    expect(item({}, { booked: true, fileCount: 2 })).toEqual({ ...source(), booked: true, fileCount: 2 });
  });

  it("reads a cost or capacity of 0 as unknown, since a cleared number is saved as 0", () => {
    expect(costOf(source({ budgetEstimate: 0 }))).toBeNull();
    expect(capacityOf(source({ guestMax: 0 }))).toBeNull();
    expect(costOf(source())).toBe(250_000_000);
    expect(capacityOf(source())).toBe(300);
  });

  it("names the booked venues, in the order given", () => {
    const list = [item({ id: "a" }, { booked: true }), item({ id: "b" }), item({ id: "c" }, { booked: true })];
    expect(bookedVenues(list).map((v) => v.id)).toEqual(["a", "c"]);
  });
});

describe("the list in view", () => {
  const list = [
    item({ id: "a", name: "Villa Samaya Ubud" }),
    item({ id: "b", name: "Puri Taman Sari", budgetEstimate: 180_000_000, guestMax: 200, location: "Seminyak" }),
    item({ id: "c", name: "Bukit Ungasan Cliff", budgetEstimate: 0, guestMax: 0, status: "Shortlist" }),
    item({ id: "d", name: "Pantai Gelap", budgetEstimate: 90_000_000, guestMax: 120, status: "Rejected" }),
  ];

  it("hides the ruled-out ones by default and says how many are hidden", () => {
    const v = view(list);
    expect(v.rows.map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(v.hidden).toBe(1);
  });

  it("shows them, with nothing hidden, when asked", () => {
    const v = view(list, { hideRuledOut: false });
    expect(v.rows.map((r) => r.id)).toEqual(["d", "b", "a", "c"]);
    expect(v.hidden).toBe(0);
  });

  it("counts only the hidden ones that fit everything else", () => {
    expect(view(list, { query: "seminyak" }).hidden).toBe(0);
    expect(view(list, { query: "pantai" }).hidden).toBe(1);
  });

  it("puts a venue with no cost or capacity last in either direction", () => {
    expect(view(list, {}, { key: "cost", direction: "desc" }).rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(view(list, {}, { key: "capacity", direction: "desc" }).rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("leaves out venues that don't say while a limit is set", () => {
    expect(view(list, { maxCost: 200_000_000 }).rows.map((r) => r.id)).toEqual(["b"]);
    expect(view(list, { minGuests: 250 }).rows.map((r) => r.id)).toEqual(["a"]);
  });

  it("takes a page and says how many more the next adds", () => {
    const many = Array.from({ length: 130 }, (_, i) => item({ id: `v${i}`, name: `Venue ${i}` }));
    const v = venueView(many, NO_VENUE_FILTER, { key: "name", direction: "asc" }, 60, 60);
    expect(v.rows).toHaveLength(130);
    expect(v.shown).toBe(60);
    expect(v.more).toBe(60);
  });
});

describe("the words of the list", () => {
  it("says how many venues there are, or what the page is for", () => {
    expect(venuesSub(4)).toBe("4 venues");
    expect(venuesSub(1)).toBe("1 venue");
    expect(venuesSub(0)).toBe("Places you’re weighing up");
  });

  it("writes the count line: all, hidden, filtered, paged", () => {
    expect(countText(4, 4, false, 0)).toBe("4 venues");
    expect(countText(4, 4, false, 2)).toBe("4 venues, 2 ruled out hidden");
    expect(countText(12, 12, true, 0)).toBe("12 venues here");
    expect(countText(302, 60, false, 0)).toBe("302 venues, showing 60");
    expect(countText(302, 60, true, 1)).toBe("Showing 60 of 302, 1 ruled out hidden");
  });

  it("says what fits nothing, naming every choice that narrows", () => {
    expect(noResultsBody({ ...NO_VENUE_FILTER, query: "beach", maxCost: 200_000_000 })).toBe("Nothing fits “beach”, at most Rp 200.000.000.");
    expect(noResultsBody({ ...NO_VENUE_FILTER, minGuests: 1500, stage: "Toured" })).toBe("Nothing fits at least 1.500 guests, at the stage Visited.");
    expect(noResultsBody(NO_VENUE_FILTER)).toBe("Nothing fits these choices.");
    expect(noResultsBody({ ...NO_VENUE_FILTER, query: "x".repeat(60) })).toContain(`${"x".repeat(40)}…`);
  });

  it("writes capacity in people, with the dots", () => {
    expect(capacityText(300)).toBe("Up to 300 guests");
    expect(capacityText(1)).toBe("Up to 1 guest");
    expect(capacityText(125_000)).toBe("Up to 125.000 guests");
    expect(CAPACITY_UNKNOWN).toBe("Capacity unknown");
  });

  it("cuts a note at 140 characters with an ellipsis, and leaves a short one alone", () => {
    expect(noteOnRow("Short")).toBe("Short");
    expect(noteOnRow("a".repeat(NOTE_CUT))).toBe("a".repeat(NOTE_CUT));
    const cut = noteOnRow("a".repeat(NOTE_CUT + 1));
    expect(cut).toHaveLength(NOTE_CUT - 1);
    expect(cut.endsWith("…")).toBe(true);
  });
});

describe("removing a venue (N10)", () => {
  const facts = { name: "Puri Taman Sari", hasNotes: false, fileCount: 0, booked: false };

  it("says what leaves, what stays, and the undo promise", () => {
    expect(removeVenueBody(facts)).toBe("It leaves Venues. You can undo for a few seconds.");
    expect(removeVenueBody({ ...facts, hasNotes: true, fileCount: 1 })).toBe(
      "It leaves Venues, with its notes. Its file stays in Files › Venues › Puri Taman Sari. You can undo for a few seconds.",
    );
    expect(removeVenueBody({ ...facts, fileCount: 12, booked: true })).toBe(
      "It leaves Venues. Its 12 files stay in Files › Venues › Puri Taman Sari. Its booking stays in the budget. You can undo for a few seconds.",
    );
  });
});

describe("most guests", () => {
  it("reads whole people, with dots or commas only as thousands, and blank as none", () => {
    expect(readGuests("250")).toEqual({ ok: true, value: 250 });
    expect(readGuests(" 1.200 ")).toEqual({ ok: true, value: 1200 });
    expect(readGuests("125,000")).toEqual({ ok: true, value: 125_000 });
    expect(readGuests("")).toEqual({ ok: true, value: null });
  });

  it("refuses words, decimals and more people than a venue holds", () => {
    expect(readGuests("lots")).toEqual({ ok: false, problem: "words" });
    expect(readGuests("2,5")).toEqual({ ok: false, problem: "words" });
    expect(readGuests("−3")).toEqual({ ok: false, problem: "words" });
    expect(readGuests("12.000.000")).toEqual({ ok: false, problem: "big" });
  });

  it("gives the filter box a number, null for blank and undefined for text", () => {
    expect(readGuestFilter("250")).toBe(250);
    expect(readGuestFilter("")).toBeNull();
    expect(readGuestFilter("lots")).toBeUndefined();
  });

  it("quotes what was typed and says what it stays as (N16's pattern)", () => {
    expect(guestsMessage("words", "lots", 250)).toBe("“lots” isn’t a number of guests. Use digits, like 250. It stays 250.");
    expect(guestsMessage("words", "lots", null)).toBe("“lots” isn’t a number of guests. Use digits, like 250. Nothing was changed.");
    expect(guestsMessage("big", "12.000.000", 1200)).toBe("That’s more guests than this can hold: up to 9.999.999. It stays 1.200.");
  });
});
