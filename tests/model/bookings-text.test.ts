import { describe, expect, it } from "vitest";
import { countText, noResultsTitle } from "@/veil/screens/bookings/bookings-text";

// Task 4.5: the words of the Bookings screen (guide §5.5, §6.7, §6.8).

describe("the no-results title", () => {
  it("quotes the search as it was typed, without its edge spaces", () => {
    expect(noResultsTitle("fireworks")).toBe("No bookings match “fireworks”");
    expect(noResultsTitle("  Not assigned ")).toBe("No bookings match “Not assigned”");
  });
});

describe("the count above the list", () => {
  it("says how many match while a search is on, with the right verb", () => {
    expect(countText("fire", 1, 1)).toBe("1 booking matches");
    expect(countText("fire", 3, 3)).toBe("3 bookings match");
    expect(countText("fire", 150, 100)).toBe("150 bookings match");
  });

  it("says how far the list has paged, and nothing when all of it fits", () => {
    expect(countText("", 1206, 100)).toBe("Showing 100 of 1.206");
    expect(countText("", 100, 100)).toBeNull();
  });

  it("treats a search of spaces as no search", () => {
    expect(countText("   ", 3, 3)).toBeNull();
  });
});
