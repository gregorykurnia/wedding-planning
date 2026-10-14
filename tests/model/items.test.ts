import { describe, expect, it } from "vitest";
import { NO_ITEM_FILTER, filterItems, isFilteringItems, itemCounts, workOnNext, type ItemRecord } from "@/lib/model/items";

let n = 0;
const item = (over: Partial<ItemRecord> = {}): ItemRecord => ({
  id: `i${++n}`,
  item: `Item ${n}`,
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

describe("workOnNext", () => {
  it("lists up to 12 and says how many more", () => {
    const items = Array.from({ length: 16 }, () => item({ next: true }));
    const w = workOnNext([item(), ...items]);
    expect(w.shown).toHaveLength(12);
    expect(w.more).toBe(4);
    expect(workOnNext([item()])).toEqual({ shown: [], more: 0 });
  });
});
