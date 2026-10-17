import { describe, expect, it } from "vitest";
import { buildCategories } from "@/lib/model/categories";
import { NO_VENDOR_FILTER } from "@/lib/model/search";
import {
  VENDOR_COLUMNS,
  groupByCategory,
  keenCount,
  vendorFocus,
  vendorListItem,
  vendorView,
  vendorsCsv,
  type VendorExtras,
  type VendorListItem,
  type VendorSource,
} from "@/lib/model/vendors";

// Task 4.11: the Vendors list's pure parts (guide §5.11): a stored vendor as a
// row, the list in view, the category headings and the spreadsheet (N5).

const source = (over: Partial<VendorSource> = {}): VendorSource => ({
  id: "v1",
  name: "Kebun Bunga Atelier",
  category: "Decoration",
  contractStatus: "Consideration",
  contactName: "Bu Ayu",
  contactPhone: "0812 3456 7890",
  notes: "Peonies, “not roses”",
  keen: true,
  rating: 4.8,
  reviewers: 120,
  priceOptions: [],
  createdAt: Date.parse("2026-05-02T10:00:00"),
  ...over,
});

const extras: VendorExtras = { booked: false, fileCount: 0, finalistId: null };
const item = (over: Partial<VendorSource> = {}, more: Partial<VendorExtras> = {}) =>
  vendorListItem(source(over), { ...extras, ...more });

describe("vendorListItem", () => {
  it("shows the option we lean towards, or the first one, as the row's price", () => {
    const options = [
      { description: "Silver", price: 45_000_000, selected: false },
      { description: "Gold", price: 62_500_000, selected: true },
    ];
    expect(item({ priceOptions: options }).price).toBe(62_500_000);
    expect(item({ priceOptions: options }).leaning).toEqual({ description: "Gold", price: 62_500_000 });
    const none = item({ priceOptions: options.map((o) => ({ ...o, selected: false })) });
    expect(none.price).toBe(45_000_000);
    expect(none.leaning).toBeNull();
  });

  it("has no price for no options, or for an option still at 0", () => {
    expect(item().price).toBeNull();
    expect(item({ priceOptions: [{ description: "", price: 0, selected: true }] }).price).toBeNull();
    expect(item().optionCount).toBe(0);
  });

  it("treats a rating of 0 as cleared, and maps keen to starred", () => {
    expect(item({ rating: 0 }).bridestoryRating).toBeNull();
    expect(item({ rating: null }).bridestoryRating).toBeNull();
    expect(item({ rating: 4.8 }).bridestoryRating).toBe(4.8);
    expect(item({ keen: true }).starred).toBe(true);
  });

  it("carries what the spreadsheet needs from outside the document", () => {
    const v = item({}, { booked: true, fileCount: 2, finalistId: "f1" });
    expect([v.booked, v.fileCount, v.finalistId]).toEqual([true, 2, "f1"]);
  });
});

const list = (...over: Partial<VendorSource>[]) =>
  over.map((o, i) => item({ id: `v${i}`, name: `Vendor ${i}`, ...o }));

const CATEGORIES = buildCategories(["Florist"]);

describe("vendorView", () => {
  const vendors = list(
    { name: "Harbour Table", category: "Food", keen: false },
    { name: "Lantern Florist", category: "Florist", keen: true },
    { name: "Paper Moon", category: "Photos and Videos", keen: true },
    { name: "Sunday Sound", category: "Music/DJ", keen: false, notes: "A harpist too" },
  );

  it("orders by category in the shared list's order, then name", () => {
    const view = vendorView(vendors, NO_VENDOR_FILTER, { key: "category", direction: "asc" }, CATEGORIES, 100, 100);
    expect(view.rows.map((v) => v.category)).toEqual(["Food", "Music/DJ", "Photos and Videos", "Florist"]);
  });

  it("filters by search, category and keen together, and each narrows", () => {
    const order = { key: "name", direction: "asc" } as const;
    const search = vendorView(vendors, { ...NO_VENDOR_FILTER, query: "harpist" }, order, CATEGORIES, 100, 100);
    expect(search.rows.map((v) => v.name)).toEqual(["Sunday Sound"]);
    const keen = vendorView(vendors, { ...NO_VENDOR_FILTER, keen: true }, order, CATEGORIES, 100, 100);
    expect(keen.rows.map((v) => v.name)).toEqual(["Lantern Florist", "Paper Moon"]);
    const both = vendorView(vendors, { query: "moon", category: "Florist", keen: true }, order, CATEGORIES, 100, 100);
    expect(both.rows).toEqual([]);
  });

  it("pages: shows `shown` rows and says how many the next page adds", () => {
    const many = list(...Array.from({ length: 230 }, (_, i) => ({ name: `V ${String(i).padStart(3, "0")}` })));
    const first = vendorView(many, NO_VENDOR_FILTER, { key: "name", direction: "asc" }, CATEGORIES, 100, 100);
    expect([first.rows.length, first.shown, first.more]).toEqual([230, 100, 100]);
    const last = vendorView(many, NO_VENDOR_FILTER, { key: "name", direction: "asc" }, CATEGORIES, 300, 100);
    expect([last.shown, last.more]).toEqual([230, 0]);
  });
});

describe("groupByCategory", () => {
  it("puts the page's rows under headings whose counts cover the whole category", () => {
    const all = list(
      { category: "Food" },
      { category: "Food" },
      { category: "Food" },
      { category: "Florist" },
    );
    const groups = groupByCategory(all, all.slice(0, 2));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ category: "Food", count: 3 });
    expect(groups[0].rows).toHaveLength(2);
  });

  it("starts a new heading each time the category changes", () => {
    const all = list({ category: "Food" }, { category: "Florist" }, { category: "Food" });
    expect(groupByCategory(all, all).map((g) => g.category)).toEqual(["Food", "Florist", "Food"]);
  });
});

describe("focus and keen counts", () => {
  it("lists only categories that hold a vendor, with their counts", () => {
    const vendors = list({ category: "Food" }, { category: "Food" }, { category: "Florist" });
    expect(vendorFocus(CATEGORIES, vendors)).toEqual([
      { name: "Food", count: 2 },
      { name: "Florist", count: 1 },
    ]);
  });

  it("counts the ones we're keen on", () => {
    expect(keenCount(list({ keen: true }, { keen: false }, { keen: true }))).toBe(2);
  });
});

describe("the spreadsheet (N5)", () => {
  const options = [
    { description: "Silver, 300 guests", price: 45_000_000, selected: false },
    { description: "Gold, 400 guests", price: 161_000_000, selected: true },
  ];
  const full = item({ priceOptions: options }, { booked: true, fileCount: 2, finalistId: "f1" });
  const cells = (v: VendorListItem) => Object.fromEntries(VENDOR_COLUMNS.map((c) => [c.header, c.value(v)]));

  it("has the columns, in the order of the vendor screen", () => {
    expect(VENDOR_COLUMNS.map((c) => c.header)).toEqual([
      "Name",
      "Category",
      "Stage",
      "Keen on",
      "Contact person",
      "Phone",
      "WhatsApp",
      "Rating (out of 5)",
      "Number of reviewers",
      "Leaning towards",
      "Its price (Rp)",
      "Price options",
      "All price options",
      "On the shortlist",
      "Booked",
      "Files",
      "Notes",
      "Date added",
    ]);
  });

  it("writes stages as the planner names them and yes or no for the flags", () => {
    const row = cells(full);
    expect(row["Stage"]).toBe("Considering");
    expect(cells(item({ contractStatus: "Rejected" }))["Stage"]).toBe("Ruled out");
    expect([row["Keen on"], row["On the shortlist"], row["Booked"]]).toEqual(["Yes", "Yes", "Yes"]);
    const bare = cells(item({ keen: false }));
    expect([bare["Keen on"], bare["On the shortlist"], bare["Booked"]]).toEqual(["No", "No", "No"]);
  });

  it("is ready to analyse: plain rupiah, a decimal point, year-month-day, empty cells for what isn't known", () => {
    const row = cells(full);
    expect(row["Its price (Rp)"]).toBe("161000000");
    expect(row["Rating (out of 5)"]).toBe(4.8);
    expect(row["Date added"]).toBe("2026-05-02");
    expect(row["Leaning towards"]).toBe("Gold, 400 guests");
    expect(row["Price options"]).toBe(2);
    expect(row["All price options"]).toBe("Silver, 300 guests: Rp 45.000.000; Gold, 400 guests: Rp 161.000.000");
    const empty = cells(item({ rating: null, reviewers: null, contactPhone: "", createdAt: null }));
    expect([empty["Rating (out of 5)"], empty["Number of reviewers"], empty["WhatsApp"], empty["Date added"]]).toEqual([
      "",
      "",
      "",
      "",
    ]);
    expect([empty["Leaning towards"], empty["Its price (Rp)"]]).toEqual(["", ""]);
  });

  it("makes the WhatsApp link from the phone the planner's way", () => {
    expect(cells(full)["WhatsApp"]).toBe("https://wa.me/6281234567890");
  });

  it("is UTF-8 with a byte-order mark, every cell quoted, Windows line endings", () => {
    const csv = vendorsCsv([full, item({ name: '王小明 "Wang", Studio' })]);
    expect(csv.startsWith("﻿\"Name\",\"Category\"")).toBe(true);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith('"Kebun Bunga Atelier","Decoration"')).toBe(true);
    expect(lines[2].startsWith('"王小明 ""Wang"", Studio"')).toBe(true);
    // A number is quoted too, and so is an empty cell.
    expect(lines[1]).toContain('"161000000"');
    expect(lines[2]).toContain('""');
  });
});
