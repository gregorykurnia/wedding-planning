import { describe, expect, it } from "vitest";
import {
  GUEST_EVENTS,
  ITEM_EVENTS,
  ITEM_PEOPLE,
  REMINDER_CHOICES,
  RSVPS,
  SCHEDULE_KINDS,
  VENDOR_STAGES,
  VENUE_STAGES,
  indexOf,
  labelOf,
  reminderChoice,
  reminderLabel,
  vendorStageLabel,
  venueStageLabel,
} from "@/lib/model/labels";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_STORED,
  OTHER_CATEGORY,
  buildCategories,
  categoryList,
  choicesWith,
  defaultCategoryId,
  storedOrDefault,
  categoryRank,
  categoryRows,
  charactersLeft,
  focusCategories,
  validateCategoryName,
} from "@/lib/model/categories";

describe("labels", () => {
  it("maps vendor stages, with Rejected shown as Ruled out", () => {
    expect(VENDOR_STAGES.map((s) => s.label)).toEqual(["Noted", "Inquiring", "Considering", "Chosen", "Done"]);
    expect(vendorStageLabel("List")).toBe("Noted");
    expect(vendorStageLabel("Consideration")).toBe("Considering");
    expect(vendorStageLabel("Rejected")).toBe("Ruled out");
  });

  it("maps venue stages", () => {
    expect(VENUE_STAGES.map((s) => s.label)).toEqual(["Noted", "Contacted", "Visited", "Booked"]);
    expect(venueStageLabel("Shortlist")).toBe("Noted");
    expect(venueStageLabel("Toured")).toBe("Visited");
    expect(venueStageLabel("Rejected")).toBe("Ruled out");
  });

  it("maps the guest's events and replies", () => {
    expect(labelOf(GUEST_EVENTS, "Both")).toBe("Both events");
    expect(labelOf(GUEST_EVENTS, "Matrimony")).toBe("Ceremony only");
    expect(labelOf(GUEST_EVENTS, "Reception")).toBe("Reception only");
    expect(labelOf(GUEST_EVENTS, "Reception Shortlist")).toBe("Reception if space allows");
    expect(labelOf(GUEST_EVENTS, "Unsure (Abroad)")).toBe("Unsure, living abroad");
    expect(RSVPS.map((r) => r.label)).toEqual(["Waiting", "Attending", "Not attending"]);
    expect(labelOf(RSVPS, "pending")).toBe("Waiting");
  });

  it("maps item events and people", () => {
    expect(labelOf(ITEM_EVENTS, "Matrimony")).toBe("Holy matrimony");
    expect(labelOf(ITEM_EVENTS, "Pre-Wedding")).toBe("Pre-wedding");
    expect(labelOf(ITEM_PEOPLE, "Groom Dad")).toBe("Groom's father");
    expect(labelOf(ITEM_PEOPLE, "Bride Brothers")).toBe("Bride's brothers");
    expect(ITEM_PEOPLE).toHaveLength(10);
  });

  it("maps schedule kinds, including the new key date and organiser call", () => {
    expect(SCHEDULE_KINDS.map((k) => k.label)).toEqual([
      "Key date",
      "Vendor call",
      "Organiser call",
      "Appointment",
      "Payment",
      "Deadline",
      "Other",
    ]);
  });

  it("shows a value it doesn't know as written, and nothing for nothing", () => {
    expect(labelOf(VENDOR_STAGES, "Something new")).toBe("Something new");
    expect(labelOf(VENDOR_STAGES, null)).toBe("");
    expect(labelOf(VENDOR_STAGES, undefined)).toBe("");
    expect(indexOf(VENDOR_STAGES, "Chosen")).toBe(3);
    expect(indexOf(VENDOR_STAGES, "Rejected")).toBe(-1);
  });

  it("reads a stored reminder as one choice", () => {
    expect(REMINDER_CHOICES.map((c) => c.minutes)).toEqual([null, 0, 15, 60, 1440, 10080]);
    expect(reminderChoice([])).toBeNull();
    expect(reminderChoice(undefined)).toBeNull();
    expect(reminderChoice([1440])).toBe(1440);
    expect(reminderChoice([15, 60])).toBe(15);
    expect(reminderLabel([])).toBe("No reminder");
    expect(reminderLabel([0])).toBe("When it starts");
    expect(reminderLabel([10080])).toBe("1 week before");
    expect(reminderLabel([30])).toBe("30 minutes before");
  });
});

describe("categories", () => {
  it("lists the common categories A to Z while none are stored, with Other last", () => {
    const list = categoryList([]);
    expect(list).toHaveLength(DEFAULT_CATEGORIES.length + 1);
    expect(list.slice(0, 3)).toEqual(["Bridal Gown", "Catering", "Civil Registration"]);
    expect(list[list.length - 1]).toBe(OTHER_CATEGORY);
  });

  it("lists only the stored ones once any are, A to Z, with Other last", () => {
    const list = categoryList([
      { id: "a", name: "Venue" },
      { id: "b", name: "Sangjit gifts" },
      { id: "c", name: "catering" },
    ]);
    expect(list).toEqual(["catering", "Sangjit gifts", "Venue", OTHER_CATEGORY]);
  });

  it("drops duplicates, blanks, All and a second Other, ignoring case", () => {
    const list = buildCategories(["Food", "food", "Sangjit gifts", "SANGJIT GIFTS", "  ", "other", "All"]);
    expect(list).toEqual(["Food", "Sangjit gifts", "Other"]);
  });

  it("stores the common ones under ids that are the same everywhere", () => {
    expect(defaultCategoryId("Photo and Video")).toBe("default-photo-and-video");
    expect(defaultCategoryId("MC")).toBe("default-mc");
    expect(new Set(DEFAULT_STORED.map((c) => c.id)).size).toBe(DEFAULT_CATEGORIES.length);
    expect(storedOrDefault([])).toBe(DEFAULT_STORED);
    expect(storedOrDefault([{ id: "x", name: "Henna" }])).toEqual([{ id: "x", name: "Henna" }]);
  });

  it("rejects a name that is empty, too long, reserved or taken", () => {
    const existing = ["Catering"];
    expect(validateCategoryName("  ", existing)).toBe("Give the category a name.");
    expect(validateCategoryName("x".repeat(41), existing)).toBe("Keep it to 40 characters or fewer.");
    expect(validateCategoryName("x".repeat(40), existing)).toBeNull();
    expect(validateCategoryName("All", existing)).toMatch(/shows everything/);
    expect(validateCategoryName("catering", existing)).toBe("There's already a category called Catering.");
    expect(validateCategoryName(" Other ", existing)).toBe("There's already a category called Other.");
    expect(validateCategoryName("Fireworks", existing)).toBeNull();
  });

  it("counts characters, not code units (CJK and emoji)", () => {
    expect(validateCategoryName("婚".repeat(40), [])).toBeNull();
    expect(validateCategoryName("婚".repeat(41), [])).not.toBeNull();
    expect(validateCategoryName("😀".repeat(40), [])).toBeNull();
    expect(charactersLeft("")).toBe(40);
    expect(charactersLeft("Catering ")).toBe(32);
    expect(charactersLeft("婚礼前拍摄与家庭聚会")).toBe(30);
    expect(charactersLeft("x".repeat(45))).toBe(-5);
  });

  it("describes each category for the categories sheet: its id and what's in it", () => {
    const stored = [
      { id: "c1", name: "Venue" },
      { id: "c2", name: "Sangjit gifts" },
    ];
    const rows = categoryRows(stored, [{ category: "Venue" }, { category: "Sangjit gifts" }, { category: "Sangjit gifts" }, { category: "Other" }], [
      { category: "Venue" },
      { category: "Other" },
      { category: "Other" },
    ]);
    expect(rows).toEqual([
      { name: "Sangjit gifts", id: "c2", vendors: 2, items: 0 },
      { name: "Venue", id: "c1", vendors: 1, items: 1 },
      { name: "Other", id: null, vendors: 1, items: 2 },
    ]);
    // While none are stored, the rows carry the ids the common ones will be stored under.
    expect(categoryRows([], []).find((r) => r.name === "Florist")?.id).toBe("default-florist");
  });

  it("offers a record's own category in its picker even when it isn't in the list", () => {
    const list = ["Venue", "Other"];
    expect(choicesWith(list, "Venue")).toEqual(list);
    expect(choicesWith(list, "venue")).toEqual(list);
    expect(choicesWith(list, "Henna")).toEqual(["Venue", "Henna", "Other"]);
    expect(choicesWith(list, "")).toEqual(list);
  });

  it("ranks by list position, with unknown names after every known one", () => {
    const list = buildCategories(["Sangjit gifts", "Decoration"]);
    expect(categoryRank(list, "Decoration")).toBe(0);
    expect(categoryRank(list, "decoration")).toBe(0);
    expect(categoryRank(list, "Other")).toBe(list.length - 1);
    expect(categoryRank(list, "Gone")).toBe(list.length);
  });

  it("offers a focus chip only for categories that hold something", () => {
    const list = buildCategories(["Sangjit gifts", "Decoration", "Wedding Cake"]);
    const chips = focusCategories(list, [
      { category: "Wedding Cake" },
      { category: "Decoration" },
      { category: "Decoration" },
      { category: "Gone" },
    ]);
    expect(chips).toEqual([
      { name: "Decoration", count: 2 },
      { name: "Wedding Cake", count: 1 },
      { name: "Gone", count: 1 },
    ]);
  });
});
