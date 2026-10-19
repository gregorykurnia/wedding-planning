import { describe, expect, it } from "vitest";
import {
  INVITE_FILTER_OPTIONS,
  RSVP_FILTER_OPTIONS,
  addSheetSub,
  addedToast,
  countLine,
  editSheetSub,
  guestsSub,
  noMatchTitle,
  removeBody,
  removeTitle,
  removedToast,
  rsvpConflict,
  rsvpConflictOwn,
} from "@/veil/screens/guests/guests-text";

// Task 4.24: the words of the Guests screen and its sheets (guide §5.23, §6.2, §6.8).

describe("the line under the title", () => {
  it("counts guests and the people with plus-ones, or invites the first guest", () => {
    expect(guestsSub(20, 34)).toBe("20 guests invited, 34 people with plus-ones");
    expect(guestsSub(1, 1)).toBe("1 guest invited, 1 person with plus-ones");
    expect(guestsSub(1200, 2100)).toBe("1.200 guests invited, 2.100 people with plus-ones");
    expect(guestsSub(0, 0)).toBe("Who’s coming to what");
  });
});

describe("the count over the list", () => {
  it("says how many, how many of all while filtering, and how many are shown when paged", () => {
    expect(countLine(20, 20, 20, false)).toBe("20 guests");
    expect(countLine(1, 1, 20, true)).toBe("1 guest of 20");
    expect(countLine(3, 3, 1500, true)).toBe("3 guests of 1.500");
    expect(countLine(1500, 100, 1500, false)).toBe("1.500 guests, showing 100");
    expect(countLine(400, 100, 1500, true)).toBe("400 guests of 1.500, showing 100");
  });
});

describe("the filters", () => {
  it("offers Any, then each reply and each event in the model's words", () => {
    expect(RSVP_FILTER_OPTIONS.map((o) => o.label)).toEqual(["Any", "Waiting", "Attending", "Not attending"]);
    expect(RSVP_FILTER_OPTIONS.map((o) => o.value)).toEqual(["", "pending", "yes", "no"]);
    expect(INVITE_FILTER_OPTIONS[0]).toEqual({ value: "", label: "Any event" });
    expect(INVITE_FILTER_OPTIONS.map((o) => o.label)).toContain("Reception if space allows");
  });

  it("names what a search found nothing for", () => {
    expect(noMatchTitle("Surabaya")).toBe("No guests match “Surabaya”");
    expect(noMatchTitle("  ")).toBe("No guests match");
  });
});

describe("the sheets", () => {
  it("says which number the next guest gets, and which number this one has", () => {
    expect(addSheetSub(21)).toBe("Will be guest number 21");
    expect(editSheetSub(3)).toBe("Guest number 3");
    expect(editSheetSub(null)).toBeNull();
    expect(editSheetSub(undefined)).toBeNull();
    expect(addedToast(" 王小明 ", 21)).toBe("Added 王小明 as guest 21");
  });
});

describe("removing a guest", () => {
  it("names the plus-ones and the headcount drop, or says the number isn't reused", () => {
    expect(removeTitle("Maria Goretti")).toBe("Remove Maria Goretti?");
    expect(removeBody({ name: "Maria Goretti", plusOnes: 2 })).toBe(
      "Maria Goretti was bringing 2 plus-ones, so the headcount drops by 3. You can undo for a few seconds.",
    );
    expect(removeBody({ name: "Wayan", plusOnes: 1 })).toBe(
      "Wayan was bringing 1 plus-one, so the headcount drops by 2. You can undo for a few seconds.",
    );
    expect(removeBody({ name: "Wayan", plusOnes: 0 })).toBe("You can undo for a few seconds. Their number isn’t reused.");
    expect(removedToast("Wayan")).toBe("Removed Wayan");
  });

  it("says when Undo of a reply finds the guest changed since", () => {
    expect(rsvpConflict("Bella", "Wayan")).toBe("Can’t undo the reply: Bella has changed Wayan since. It’s kept as it is now.");
    expect(rsvpConflictOwn("Wayan")).toBe("Can’t undo the reply: you’ve changed Wayan since. It’s kept as it is now.");
  });
});
