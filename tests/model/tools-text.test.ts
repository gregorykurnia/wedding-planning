import { describe, expect, it } from "vitest";
import {
  hereText,
  matchText,
  moreText,
  ofText,
  pagedText,
  showingOfText,
  sortedNoteText,
  totalText,
} from "@/veil/parts/tools/tools-text";

// Task 3.7: the words of the search and ordering tools (guide §4.12, §6.8).
// Counts use the model's dots, and the singular is written for one.

describe("the count line", () => {
  it("says the total, and how many are showing when the list is paged", () => {
    expect(totalText(12, "vendor")).toBe("12 vendors");
    expect(totalText(1, "vendor")).toBe("1 vendor");
    expect(pagedText(1206, 100, "booking")).toBe("1.206 bookings, showing 100");
  });

  it("says how many match, with here for a search and match for a filter", () => {
    expect(hereText(12, "vendor")).toBe("12 vendors here");
    expect(matchText(3, "booking")).toBe("3 bookings match");
    expect(matchText(1, "booking")).toBe("1 booking matches");
  });

  it("counts out of the total, as the guide does", () => {
    expect(ofText(12, 2004)).toBe("12 of 2.004");
    expect(showingOfText(60, 1507)).toBe("Showing 60 of 1.507");
  });
});

describe("the sorted note and the paging button", () => {
  it("names the order in lower case and says the own order is kept", () => {
    expect(sortedNoteText("Vendor")).toBe("Sorted by vendor for now. Your own order is kept.");
  });

  it("always says how many more the button shows", () => {
    expect(moreText(100)).toBe("Show 100 more");
    expect(moreText(1000)).toBe("Show 1.000 more");
  });
});
