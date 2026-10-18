import { describe, expect, it } from "vitest";
import { buildCategories } from "@/lib/model/categories";
import {
  CARD_PACKAGES,
  finalistListItem,
  finalistMeta,
  groupFinalists,
  morePackages,
  shortlistFocus,
  shortlistSub,
  shortlistView,
  stepText,
  type FinalistListItem,
  type FinalistSource,
} from "@/lib/model/shortlist";

// Task 4.13: the Shortlist as the screen reads it (guide §5.13; F17–F19).

const CATEGORIES = buildCategories([]);

const source = (id: string, name: string, over: Partial<FinalistSource> = {}): FinalistSource => ({
  id,
  name,
  category: "Food",
  packages: [{ id: "main", name: "Buffet", price: 80_000_000 }],
  preferredPackageId: "main",
  reviewers: null,
  igFollowers: null,
  step: "",
  movedTo: null,
  ...over,
});

const item = (id: string, name: string, over: Partial<FinalistSource> = {}) => finalistListItem(source(id, name, over));

describe("finalistListItem", () => {
  it("marks the package we're leaning towards, falling back to the first", () => {
    const leaning = item("a", "A", {
      packages: [
        { id: "main", name: "Silver", price: 45 },
        { id: "p2", name: "Gold", price: 62 },
      ],
      preferredPackageId: "p2",
    });
    expect(leaning.packages.map((p) => p.preferred)).toEqual([false, true]);
    const gone = item("a", "A", {
      packages: [
        { id: "main", name: "Silver", price: 45 },
        { id: "p2", name: "Gold", price: 62 },
      ],
      preferredPackageId: "removed",
    });
    expect(gone.packages.map((p) => p.preferred)).toEqual([true, false]);
  });

  it("doesn't show the finalist's own price and name as a package until either is filled in", () => {
    const bare = item("a", "A", { packages: [{ id: "main", name: "", price: 0 }] });
    expect(bare.packages).toEqual([]);
    const priced = item("a", "A", { packages: [{ id: "main", name: "", price: 5_000_000 }] });
    expect(priced.packages).toHaveLength(1);
    const named = item("a", "A", { packages: [{ id: "main", name: "Signature", price: 0 }] });
    expect(named.packages).toHaveLength(1);
  });

  it("is booked only when it became a booking", () => {
    expect(item("a", "A", { movedTo: { kind: "booking" } }).booked).toBe(true);
    expect(item("a", "A", { movedTo: { kind: "vendor" } }).booked).toBe(false);
    expect(item("a", "A").booked).toBe(false);
  });
});

describe("the words on a card", () => {
  it("says reviews and followers, short, whichever are known", () => {
    expect(finalistMeta({ reviewers: 120, followers: 12_300 })).toBe("120 reviews, 12,3k followers");
    expect(finalistMeta({ reviewers: 1, followers: null })).toBe("1 review");
    expect(finalistMeta({ reviewers: null, followers: 98_765_432 })).toBe("98,8M followers");
    expect(finalistMeta({ reviewers: null, followers: null })).toBe("No reviews or followers yet");
  });

  it("cuts a long next step at 120 characters, and says nothing for none", () => {
    expect(stepText("Ask about the delivery fee")).toBe("Ask about the delivery fee");
    expect(stepText("   ")).toBeNull();
    const cut = stepText("x".repeat(130))!;
    expect(Array.from(cut)).toHaveLength(119);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("counts the packages a card doesn't list", () => {
    expect(CARD_PACKAGES).toBe(4);
    expect(morePackages(4)).toBeNull();
    expect(morePackages(5)).toBe("and 1 more package");
    expect(morePackages(30)).toBe("and 26 more packages");
  });

  it("sums the shortlist up under the title", () => {
    expect(shortlistSub([])).toBe("Finalists, side by side");
    expect(shortlistSub([{ category: "Food" }])).toBe("1 finalist in 1 category");
    expect(shortlistSub([{ category: "Food" }, { category: "Food" }, { category: "Decoration" }])).toBe(
      "3 finalists in 2 categories",
    );
  });
});

describe("shortlistView", () => {
  const list: FinalistListItem[] = [
    item("kebun", "Kebun Bunga Atelier", {
      category: "Decoration",
      packages: [
        { id: "main", name: "Silver", price: 45 },
        { id: "p2", name: "Gold", price: 62 },
      ],
      preferredPackageId: "p2",
      reviewers: 120,
      igFollowers: 12_300,
    }),
    item("ayu", "Pelaminan Ayu", { category: "Decoration", packages: [{ id: "main", name: "Classic", price: 30 }] }),
    item("arka", "Arka Visual", {
      category: "Photos and Videos",
      packages: [{ id: "main", name: "Signature", price: 18 }],
      reviewers: 64,
      igFollowers: 98_765_432,
    }),
    item("dapur", "Dapur Lestari Catering", { packages: [{ id: "main", name: "", price: 0 }] }),
  ];
  const names = (rows: readonly FinalistListItem[]) => rows.map((f) => f.name);
  const view = (key: Parameters<typeof shortlistView>[2]["key"], direction: "asc" | "desc", category = "") =>
    shortlistView(list, { category }, { key, direction }, CATEGORIES, 60, 60);

  it("orders by the shared category list, then by name", () => {
    expect(names(view("category", "asc").rows)).toEqual([
      "Kebun Bunga Atelier",
      "Pelaminan Ayu",
      "Dapur Lestari Catering",
      "Arka Visual",
    ]);
  });

  it("orders by the price we lean towards, with a finalist that has none last either way", () => {
    expect(names(view("price", "asc").rows)).toEqual([
      "Arka Visual",
      "Pelaminan Ayu",
      "Kebun Bunga Atelier",
      "Dapur Lestari Catering",
    ]);
    expect(names(view("price", "desc").rows)).toEqual([
      "Kebun Bunga Atelier",
      "Pelaminan Ayu",
      "Arka Visual",
      "Dapur Lestari Catering",
    ]);
  });

  it("orders by reviews and followers, with the unknown last", () => {
    expect(names(view("reviews", "desc").rows).slice(0, 2)).toEqual(["Kebun Bunga Atelier", "Arka Visual"]);
    expect(names(view("followers", "desc").rows).slice(0, 2)).toEqual(["Arka Visual", "Kebun Bunga Atelier"]);
    expect(names(view("followers", "asc").rows).slice(0, 2)).toEqual(["Kebun Bunga Atelier", "Arka Visual"]);
  });

  it("narrows to a category, and pages", () => {
    expect(names(view("category", "asc", "Decoration").rows)).toEqual(["Kebun Bunga Atelier", "Pelaminan Ayu"]);
    const paged = shortlistView(list, { category: "" }, { key: "category", direction: "asc" }, CATEGORIES, 3, 3);
    expect(paged.shown).toBe(3);
    expect(paged.more).toBe(1);
  });

  it("groups the page under headings that count the whole category", () => {
    const all = view("category", "asc").rows;
    const groups = groupFinalists(all, all.slice(0, 1));
    expect(groups).toEqual([{ category: "Decoration", count: 2, rows: [all[0]] }]);
    expect(groupFinalists(all, all).map((g) => [g.category, g.count])).toEqual([
      ["Decoration", 2],
      ["Food", 1],
      ["Photos and Videos", 1],
    ]);
  });

  it("offers a chip for each category that holds a finalist, in the shared order", () => {
    expect(shortlistFocus(CATEGORIES, list)).toEqual([
      { name: "Decoration", count: 2 },
      { name: "Food", count: 1 },
      { name: "Photos and Videos", count: 1 },
    ]);
  });
});
