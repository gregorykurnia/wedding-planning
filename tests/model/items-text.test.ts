import { describe, expect, it } from "vitest";
import { namesOf } from "@/veil/screens/items/add-items-sheet";
import {
  addSheetSub,
  countLine,
  itemsThread,
  moveFailed,
  noMatchTitle,
  nextLine,
  removeConfirm,
  removedToast,
  startedWith,
} from "@/veil/screens/items/items-text";

// Task 4.23: the words of the Wedding items screen (guide §5.22, §6.8).

describe("the figure's lines", () => {
  it("says how many are marked to work on next, or that none are", () => {
    expect(nextLine(6)).toBe("6 marked to work on next");
    expect(nextLine(0)).toBe("Nothing marked to work on next");
    expect(nextLine(1204)).toBe("1.204 marked to work on next");
  });

  it("gives the thread its two ends and its words", () => {
    const counts = { total: 25, confirmed: 12, toGo: 13, next: 6, percent: 48 };
    expect(itemsThread(counts)).toEqual({ ends: ["48% confirmed", "13 to go"], label: "48% confirmed, 13 to go" });
  });
});

describe("the count over the list", () => {
  it("says nothing when every item is shown and nothing narrows the list", () => {
    expect(countLine(40, 40, 40, false)).toBeNull();
  });

  it("says how many match while a search or filter is on", () => {
    expect(countLine(12, 12, 2004, true)).toBe("12 items of 2.004");
    expect(countLine(1, 1, 44, true)).toBe("1 item of 44");
  });

  it("says how many are shown when a long list is paged", () => {
    expect(countLine(2004, 150, 2004, false)).toBe("Showing 150 of 2.004");
    expect(countLine(300, 150, 2004, true)).toBe("300 items of 2.004, showing 150");
  });
});

describe("what the screen says", () => {
  it("names what nothing matched", () => {
    expect(noMatchTitle("photo booth")).toBe("Nothing matches “photo booth”");
    expect(noMatchTitle("  ")).toBe("No items fit");
  });

  it("promises the undo and where it goes back to", () => {
    expect(removeConfirm("Wedding cake")).toEqual({
      title: "Remove Wedding cake?",
      body: "You can undo for a few seconds, and it goes back exactly where it was.",
      action: "Remove item",
    });
    expect(removeConfirm("").title).toBe("Remove this item?");
    expect(removedToast("Wedding cake")).toBe("Removed Wedding cake");
  });

  it("says where the new items go", () => {
    expect(addSheetSub(null)).toBe("At the end of the list. One item per line.");
    expect(addSheetSub("Wedding cake")).toBe("Below “Wedding cake”. One item per line.");
  });

  it("says how many common items the tracker started with", () => {
    expect(startedWith(44)).toBe("The tracker starts with 44 common items. Rename, fill in or remove any of them.");
  });

  it("says a move that didn't land changed nothing", () => {
    expect(moveFailed("Wedding cake")).toBe("Couldn’t move “Wedding cake”. Nothing was changed.");
  });
});

describe("the add sheet's lines", () => {
  it("makes one item per line and leaves out blank lines", () => {
    expect(namesOf("  Bride’s mother’s makeup \n\n Groom’s father’s suit\r\n   \nRing bearer’s pillow")).toEqual([
      "Bride’s mother’s makeup",
      "Groom’s father’s suit",
      "Ring bearer’s pillow",
    ]);
    expect(namesOf(" \n ")).toEqual([]);
  });
});
