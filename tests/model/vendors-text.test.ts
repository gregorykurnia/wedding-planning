import { describe, expect, it } from "vitest";
import type { CategoryRow } from "@/lib/model/categories";
import {
  categoryNote,
  charactersNote,
  countText,
  exportLabel,
  exportedToast,
  noResults,
  removeBody,
  vendorsSub,
} from "@/veil/screens/vendors/vendors-text";

// Task 4.11: the words of the Vendors screen (guide §5.11, §6.7, §6.8).

describe("vendorsSub", () => {
  it("counts the vendors and the ones we're keen on", () => {
    expect(vendorsSub(16, 7)).toBe("16 vendors, 7 you’re keen on");
    expect(vendorsSub(1, 1)).toBe("1 vendor, 1 you’re keen on");
    expect(vendorsSub(2004, 0)).toBe("2.004 vendors");
  });

  it("has its own line when there are none", () => {
    expect(vendorsSub(0, 0)).toBe("Everyone you’re considering");
  });
});

describe("noResults", () => {
  it("quotes the search and says what search looks through", () => {
    expect(noResults({ query: " harpist ", category: "", keen: false })).toEqual({
      title: "No vendors match “harpist”",
      body: "Search looks through names, contact people and notes.",
    });
  });

  it("names the keen filter, then the category", () => {
    expect(noResults({ query: "", category: "Food", keen: true }).title).toBe("No vendors you’re keen on here");
    expect(noResults({ query: "", category: "Food", keen: false }).title).toBe("No vendors in this category yet");
  });
});

describe("countText", () => {
  it("is the total, the first page, the matches or a page of the matches", () => {
    expect(countText(16, 16, false)).toBe("16 vendors");
    expect(countText(1206, 100, false)).toBe("1.206 vendors, showing 100");
    expect(countText(12, 12, true)).toBe("12 vendors here");
    expect(countText(1507, 60, true)).toBe("Showing 60 of 1.507");
  });
});

describe("export words", () => {
  it("says all, or these, and what was exported", () => {
    expect(exportLabel(true)).toBe("Export all to a spreadsheet");
    expect(exportLabel(false)).toBe("Export these to a spreadsheet");
    expect(exportedToast(16, "vendors-greg-bella.csv")).toBe("Exported 16 vendors to vendors-greg-bella.csv");
    expect(exportedToast(1, "vendors.csv")).toBe("Exported 1 vendor to vendors.csv");
  });
});

describe("the categories sheet's words", () => {
  const row = (kind: CategoryRow["kind"], count: number): CategoryRow => ({ name: "X", kind, count });

  it("tells ours and the catch-all from the built-ins", () => {
    expect(categoryNote(row("ours", 3))).toBe("Ours, 3 vendors");
    expect(categoryNote(row("catch-all", 2))).toBe("Catch-all, 2 vendors");
    expect(categoryNote(row("built-in", 1))).toBe("1 vendor");
  });

  it("counts characters down, then says how far over", () => {
    expect(charactersNote(40)).toBe("40 characters left");
    expect(charactersNote(1)).toBe("1 character left");
    expect(charactersNote(0)).toBe("0 characters left");
    expect(charactersNote(-3)).toBe("3 characters over the limit of 40");
  });

  it("says where a removed category's vendors go, and nothing when it holds none", () => {
    expect(removeBody(4)).toBe("Its 4 vendors move to Other.");
    expect(removeBody(1)).toBe("Its 1 vendor move to Other.");
    expect(removeBody(0)).toBeUndefined();
  });
});
