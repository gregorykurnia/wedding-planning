import { describe, expect, it } from "vitest";
import { MASTER_LIST_INITIAL_ROWS } from "@/lib/collections/master-list";
import { DEFAULT_CATEGORIES } from "@/lib/model/categories";
import {
  COMMON_ITEM_CATEGORIES,
  NO_ITEM_FILTER,
  filterItems,
  isFilteringItems,
  isFor,
  itemCounts,
  namedPeople,
  peopleNames,
  peopleText,
  withEvent,
  withPerson,
  workOnNext,
  type ItemRecord,
} from "@/lib/model/items";

let n = 0;
const item = (over: Partial<ItemRecord> = {}): ItemRecord => ({
  id: `i${++n}`,
  item: `Item ${n}`,
  category: "Other",
  vendor: "",
  confirmed: false,
  types: [],
  persons: ["General"],
  next: false,
  sortOrder: n,
  ...over,
});

describe("itemCounts", () => {
  it("counts confirmed, to go and marked to work on next", () => {
    const c = itemCounts([
      item({ confirmed: true }),
      item({ confirmed: true, next: true }),
      item({ next: true }),
      item(),
    ]);
    expect(c).toEqual({ total: 4, confirmed: 2, toGo: 2, next: 2, percent: 50 });
  });

  it("rounds the percent and is zero with no items", () => {
    expect(itemCounts([item({ confirmed: true }), item(), item()]).percent).toBe(33);
    expect(itemCounts([item({ confirmed: true }), item({ confirmed: true }), item()]).percent).toBe(67);
    expect(itemCounts([])).toEqual({ total: 0, confirmed: 0, toGo: 0, next: 0, percent: 0 });
  });
});

describe("filterItems", () => {
  const list = [
    item({ item: "Wedding cake", vendor: "Manis Cake Studio", types: ["Reception"], persons: ["General"], next: true }),
    item({ item: "Bride's gown", vendor: "Maison Ayu Bridal", types: ["Matrimony", "Reception"], persons: ["Bride"], confirmed: true }),
    item({ item: "Sangjit trays", vendor: "", types: ["Sangjit"], persons: ["General"] }),
    item({ item: "Groom's mother's kebaya", vendor: "", types: ["Sangjit", "Reception"], persons: ["Groom Mom"] }),
    item({ item: "新娘的头纱", vendor: "婚礼摄影工作室", types: [], persons: ["Bride"] }),
  ];
  const names = (f: Partial<typeof NO_ITEM_FILTER>) => filterItems(list, { ...NO_ITEM_FILTER, ...f }).map((i) => i.item);

  it("searches item and vendor names", () => {
    expect(names({ query: "cake" })).toEqual(["Wedding cake"]);
    expect(names({ query: "ayu" })).toEqual(["Bride's gown"]);
    expect(names({ query: "婚礼" })).toEqual(["新娘的头纱"]);
    expect(names({ query: "photo booth" })).toEqual([]);
  });

  it("shows items with any of the events chosen (§6.8)", () => {
    expect(names({ events: ["Sangjit"] })).toEqual(["Sangjit trays", "Groom's mother's kebaya"]);
    expect(names({ events: ["Sangjit", "Matrimony"] })).toEqual(["Bride's gown", "Sangjit trays", "Groom's mother's kebaya"]);
    expect(names({ events: ["Pre-Wedding"] })).toEqual([]);
  });

  it("shows items with any of the people chosen", () => {
    expect(names({ people: ["Bride", "Groom Mom"] })).toEqual(["Bride's gown", "Groom's mother's kebaya", "新娘的头纱"]);
  });

  it("finds an item for several people by any one of them, in the filter and in the search (N12)", () => {
    const shared = [
      ...list,
      item({ item: "Makeup for both mothers", persons: ["Bride Mom", "Groom Mom"] }),
      item({ item: "Ring bearer's pillow", persons: [] }),
    ];
    const found = (f: Partial<typeof NO_ITEM_FILTER>) => filterItems(shared, { ...NO_ITEM_FILTER, ...f }).map((i) => i.item);
    expect(found({ people: ["Bride Mom"] })).toEqual(["Makeup for both mothers"]);
    expect(found({ people: ["Groom Mom"] })).toEqual(["Groom's mother's kebaya", "Makeup for both mothers"]);
    expect(found({ query: "bride's mother" })).toEqual(["Makeup for both mothers"]);
    // General is the items for no one in particular, whether stored as none or as General.
    expect(found({ people: ["General"] })).toEqual(["Wedding cake", "Sangjit trays", "Ring bearer's pillow"]);
    expect(found({ query: "general" })).toEqual(["Wedding cake", "Sangjit trays", "Ring bearer's pillow"]);
  });

  it("filters by confirmed or not, and by work on next", () => {
    expect(names({ confirmed: "yes" })).toEqual(["Bride's gown"]);
    expect(names({ confirmed: "no" })).toHaveLength(4);
    expect(names({ nextOnly: true })).toEqual(["Wedding cake"]);
  });

  it("combines every active filter", () => {
    expect(names({ events: ["Reception"], people: ["Bride"] })).toEqual(["Bride's gown"]);
    expect(names({ events: ["Reception"], confirmed: "no", query: "kebaya" })).toEqual(["Groom's mother's kebaya"]);
  });

  it("knows when something is filtering", () => {
    expect(isFilteringItems(NO_ITEM_FILTER)).toBe(false);
    expect(isFilteringItems({ ...NO_ITEM_FILTER, query: " " })).toBe(false);
    expect(isFilteringItems({ ...NO_ITEM_FILTER, events: ["Sangjit"] })).toBe(true);
    expect(isFilteringItems({ ...NO_ITEM_FILTER, nextOnly: true })).toBe(true);
  });
});

describe("item categories", () => {
  it("narrows to one category, and counts as a filter", () => {
    const list = [item({ item: "Ballroom", category: "Decoration" }), item({ item: "Cake", category: "Wedding Cake" }), item({ item: "Car" })];
    expect(filterItems(list, { ...NO_ITEM_FILTER, category: "Decoration" }).map((i) => i.item)).toEqual(["Ballroom"]);
    expect(filterItems(list, { ...NO_ITEM_FILTER, category: "Other" }).map((i) => i.item)).toEqual(["Car"]);
    expect(filterItems(list, NO_ITEM_FILTER)).toHaveLength(3);
    expect(isFilteringItems({ ...NO_ITEM_FILTER, category: "Decoration" })).toBe(true);
    expect(isFilteringItems(NO_ITEM_FILTER)).toBe(false);
  });

  it("files every common item under one of the common categories", () => {
    for (const row of MASTER_LIST_INITIAL_ROWS) expect(DEFAULT_CATEGORIES).toContain(COMMON_ITEM_CATEGORIES[row.id]);
    expect(Object.keys(COMMON_ITEM_CATEGORIES)).toHaveLength(MASTER_LIST_INITIAL_ROWS.length);
  });
});

describe("workOnNext", () => {
  it("lists up to 12 and says how many more", () => {
    const items = Array.from({ length: 16 }, () => item({ next: true }));
    const w = workOnNext([item(), ...items]);
    expect(w.shown).toHaveLength(12);
    expect(w.more).toBe(4);
    expect(workOnNext([item()])).toEqual({ shown: [], more: 0 });
  });
});

describe("who an item is for (N12)", () => {
  it("reads as text: two names in full, past two 'and N more', none as General", () => {
    expect(peopleText([])).toBe("General");
    expect(peopleText(["General"])).toBe("General");
    expect(peopleText(["Groom Dad"])).toBe("Groom's father");
    expect(peopleText(["Groom Dad", "Groom Brother"])).toBe("Groom's father, Groom's brother");
    expect(peopleText(["Bride", "Groom Dad", "Groom Brother", "Bride Mom"])).toBe("Bride, Groom's father and 2 more");
    expect(peopleText(["Bride", "Groom Dad", "Groom Brother"])).toBe("Bride, Groom's father and 1 more");
  });

  it("names everyone in full for the menu's label", () => {
    expect(peopleNames(["Bride", "Groom Dad", "Groom Brother"])).toBe("Bride, Groom's father, Groom's brother");
    expect(peopleNames([])).toBe("General");
  });

  it("leaves General out of who is named", () => {
    expect(namedPeople(["General", "Bride"])).toEqual(["Bride"]);
    expect(isFor(["General"], "General")).toBe(true);
    expect(isFor(["Bride"], "General")).toBe(false);
    expect(isFor(["Bride", "Groom"], "Groom")).toBe(true);
  });

  it("ticking people clears General, ticking General clears everyone, and clearing everyone means General", () => {
    expect(withPerson([], "Bride", true)).toEqual(["Bride"]);
    expect(withPerson(["General"], "Bride", true)).toEqual(["Bride"]);
    expect(withPerson(["Bride"], "Groom Dad", true)).toEqual(["Bride", "Groom Dad"]);
    expect(withPerson(["Bride", "Groom Dad"], "General", true)).toEqual([]);
    expect(withPerson(["Bride", "Groom Dad"], "Bride", false)).toEqual(["Groom Dad"]);
    expect(withPerson(["Bride"], "Bride", false)).toEqual([]);
    // Saying the same thing twice changes nothing, so Try again never undoes a change that landed.
    expect(withPerson(["Bride"], "Bride", true)).toEqual(["Bride"]);
    expect(withPerson([], "Bride", false)).toEqual([]);
    expect(withPerson([], "General", false)).toEqual([]);
  });

  it("switches an event on or off without doing it twice", () => {
    expect(withEvent(["Reception"], "Sangjit", true)).toEqual(["Reception", "Sangjit"]);
    expect(withEvent(["Reception", "Sangjit"], "Sangjit", true)).toEqual(["Reception", "Sangjit"]);
    expect(withEvent(["Reception", "Sangjit"], "Reception", false)).toEqual(["Sangjit"]);
    expect(withEvent([], "Reception", false)).toEqual([]);
  });
});
