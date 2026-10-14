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
  BUILT_IN_CATEGORIES,
  OTHER_CATEGORY,
  buildCategories,
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

  it("maps schedule kinds, including the new organiser call", () => {
    expect(SCHEDULE_KINDS.map((k) => k.label)).toEqual([
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
  it("lists built-ins, then ours in the order added, with Other last", () => {
    const list = buildCategories(["Sangjit gifts", "Pre-wedding"]);
    expect(list.slice(0, BUILT_IN_CATEGORIES.length)).toEqual([...BUILT_IN_CATEGORIES]);
    expect(list.slice(-3)).toEqual(["Sangjit gifts", "Pre-wedding", OTHER_CATEGORY]);
    expect(buildCategories([])).toEqual([...BUILT_IN_CATEGORIES, OTHER_CATEGORY]);
  });

  it("drops duplicates, blanks, All and a second Other, ignoring case", () => {
    const list = buildCategories(["food", "Sangjit gifts", "SANGJIT GIFTS", "  ", "other", "All"]);
    expect(list.filter((c) => c.toLowerCase() === "food")).toEqual(["Food"]);
    expect(list.filter((c) => c.toLowerCase() === "sangjit gifts")).toEqual(["Sangjit gifts"]);
    expect(list.filter((c) => c.toLowerCase() === "other")).toEqual(["Other"]);
    expect(list.map((c) => c.toLowerCase())).not.toContain("all");
    expect(list[list.length - 1]).toBe("Other");
  });

  it("rejects a name that is empty, too long, reserved or taken", () => {
    const existing = buildCategories(["Catering"]);
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

  it("describes each category for the categories sheet", () => {
    const rows = categoryRows(["Sangjit gifts"], [
      { category: "Food" },
      { category: "Sangjit gifts" },
      { category: "Sangjit gifts" },
      { category: "Other" },
    ]);
    expect(rows.find((r) => r.name === "Food")).toEqual({ name: "Food", kind: "built-in", count: 1 });
    expect(rows.find((r) => r.name === "Sangjit gifts")).toEqual({ name: "Sangjit gifts", kind: "ours", count: 2 });
    expect(rows[rows.length - 1]).toEqual({ name: "Other", kind: "catch-all", count: 1 });
  });

  it("ranks by list position, with unknown names after every known one", () => {
    const list = buildCategories(["Sangjit gifts"]);
    expect(categoryRank(list, "Decoration")).toBe(0);
    expect(categoryRank(list, "decoration")).toBe(0);
    expect(categoryRank(list, "Other")).toBe(list.length - 1);
    expect(categoryRank(list, "Gone")).toBe(list.length);
  });

  it("offers a focus chip only for categories that hold something", () => {
    const list = buildCategories(["Sangjit gifts"]);
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
