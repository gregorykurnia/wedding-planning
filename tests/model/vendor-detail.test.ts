import { describe, expect, it } from "vitest";
import {
  copiedToast,
  heroFigure,
  optionName,
  optionRemoveBody,
  ratingMessage,
  readRating,
  readReviewers,
  removeVendorBody,
  reviewersMessage,
  vendorDetail,
  type VendorDetailSource,
} from "@/lib/model/vendor-detail";

// Task 4.12: a vendor's own screen (guide §5.12): the figure, the words and the number readers.

const source = (over: Partial<VendorDetailSource> = {}): VendorDetailSource => ({
  id: "v1",
  name: "Kebun Bunga Atelier",
  category: "Decoration",
  contractStatus: "Consideration",
  keen: true,
  contactName: "Bu Ayu",
  contactPhone: "0812 3456 7890",
  rating: 4.8,
  reviewers: 120,
  notes: "",
  priceOptions: [],
  ...over,
});

const extras = { booked: false, finalistId: null, files: [] };

describe("vendorDetail", () => {
  it("names each option by its description, keeps what's included, and finds the one we lean towards", () => {
    const v = vendorDetail(
      source({
        priceOptions: [
          { id: "a", description: "Silver", price: 45_000_000, selected: false },
          { id: "b", description: "Gold", price: 62_500_000, includes: "Arch", selected: true },
        ],
      }),
      extras,
    );
    expect(v.options).toEqual([
      { id: "a", name: "Silver", price: 45_000_000, includes: "", leaning: false },
      { id: "b", name: "Gold", price: 62_500_000, includes: "Arch", leaning: true },
    ]);
    expect(v.leaningId).toBe("b");
    expect(v.stage).toBe("Consideration");
    expect(v.ruledOut).toBe(false);
  });

  it("knows a ruled-out vendor, and takes a stored rating of 0 as none", () => {
    const v = vendorDetail(source({ contractStatus: "Rejected", rating: 0 }), extras);
    expect(v.ruledOut).toBe(true);
    expect(v.rating).toBeNull();
    expect(v.leaningId).toBeNull();
  });
});

describe("heroFigure", () => {
  const opts = (...o: { name: string; price: number; leaning: boolean }[]) => ({
    options: o.map((x, i) => ({ id: String(i), includes: "", ...x })),
  });

  it("is the option we lean towards, with its price", () => {
    expect(heroFigure(opts({ name: "Gold", price: 62_500_000, leaning: true }))).toEqual({
      kind: "leaning",
      name: "Gold",
      price: 62_500_000,
    });
  });

  it("has no price yet without one we lean towards, or while it is still Rp 0", () => {
    expect(heroFigure(opts())).toEqual({ kind: "none", options: 0 });
    expect(heroFigure(opts({ name: "Silver", price: 45_000_000, leaning: false }))).toEqual({ kind: "none", options: 1 });
    expect(heroFigure(opts({ name: "Gold", price: 0, leaning: true }))).toEqual({ kind: "none", options: 1 });
  });

  it("calls an option with no name by a plain one", () => {
    expect(optionName({ name: "  " })).toBe("Price option");
    expect(heroFigure(opts({ name: "", price: 5, leaning: true }))).toMatchObject({ name: "Price option" });
  });
});

describe("readRating", () => {
  it("reads a comma or a point, keeps two decimals, and takes blank as no rating", () => {
    expect(readRating("4,8")).toEqual({ ok: true, value: 4.8 });
    expect(readRating(" 4.85 ")).toEqual({ ok: true, value: 4.85 });
    expect(readRating("5")).toEqual({ ok: true, value: 5 });
    expect(readRating("0")).toEqual({ ok: true, value: 0 });
    expect(readRating("")).toEqual({ ok: true, value: null });
  });

  it("refuses words, and anything outside 0 to 5", () => {
    expect(readRating("great")).toEqual({ ok: false, problem: "words" });
    expect(readRating("7")).toEqual({ ok: false, problem: "range" });
    expect(readRating("-1")).toEqual({ ok: false, problem: "range" });
    expect(readRating("4,8 stars")).toEqual({ ok: false, problem: "words" });
  });

  it("quotes what was typed and says what the rating stays as", () => {
    expect(ratingMessage("words", "great", 4.8)).toBe("“great” isn’t a rating. Use a number from 0 to 5, like 4,8. It stays 4,8.");
    expect(ratingMessage("range", "7", null)).toBe("“7” is outside the scale. A rating runs from 0 to 5, like 4,8. Nothing was changed.");
  });
});

describe("readReviewers", () => {
  it("reads whole people, with dots or commas only as thousands", () => {
    expect(readReviewers("120")).toEqual({ ok: true, value: 120 });
    expect(readReviewers("1.250")).toEqual({ ok: true, value: 1250 });
    expect(readReviewers("1,250")).toEqual({ ok: true, value: 1250 });
    expect(readReviewers("")).toEqual({ ok: true, value: null });
  });

  it("refuses words, decimals and slips", () => {
    expect(readReviewers("a few")).toEqual({ ok: false, problem: "words" });
    expect(readReviewers("12,5")).toEqual({ ok: false, problem: "words" });
    expect(readReviewers("-3")).toEqual({ ok: false, problem: "words" });
    expect(readReviewers("1234567890")).toEqual({ ok: false, problem: "big" });
  });

  it("says why, quoting it", () => {
    expect(reviewersMessage("words", "a few", 120)).toBe("“a few” isn’t a number of people. Use digits, like 120. It stays 120.");
    expect(reviewersMessage("big", "1234567890", 1250)).toBe("That’s more reviewers than this can hold: up to 999.999.999. It stays 1.250.");
  });
});

describe("the removal sentence (N10)", () => {
  const facts = { name: "Kebun Bunga Atelier", optionCount: 2, hasNotes: true, fileCount: 1, onShortlist: true, booked: true };

  it("names what leaves, then what stays, then the undo", () => {
    expect(removeVendorBody(facts)).toBe(
      "It leaves Vendors, with its 2 price options and notes. Its file stays in Files › Vendors › Kebun Bunga Atelier. Its copy on the shortlist stays. Its booking stays in the budget. You can undo for a few seconds.",
    );
  });

  it("says only what is true", () => {
    expect(removeVendorBody({ ...facts, optionCount: 1, hasNotes: false, fileCount: 3, onShortlist: false, booked: false })).toBe(
      "It leaves Vendors, with its 1 price option. Its 3 files stay in Files › Vendors › Kebun Bunga Atelier. You can undo for a few seconds.",
    );
    expect(removeVendorBody({ name: "X", optionCount: 0, hasNotes: false, fileCount: 0, onShortlist: false, booked: false })).toBe(
      "It leaves Vendors. You can undo for a few seconds.",
    );
  });
});

describe("other words", () => {
  it("warns that no price will count when the option we lean towards goes", () => {
    expect(optionRemoveBody(62_500_000, false)).toBe("Rp 62.500.000. You can undo for a few seconds.");
    expect(optionRemoveBody(62_500_000, true)).toBe(
      "Rp 62.500.000. It’s the one you’re leaning towards, so no price will count until you choose another. You can undo for a few seconds.",
    );
    expect(copiedToast("Kebun Bunga Atelier")).toBe("Copied Kebun Bunga Atelier to the shortlist");
  });
});
