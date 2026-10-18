import { describe, expect, it } from "vitest";
import type { Funder, WhatIfRecord } from "@/lib/model/money";
import { WHAT_IF_ORDERS, orderWhatIfs, startDirection, type OrderableWhatIf } from "@/lib/model/order";
import {
  CARRY_SHOWN,
  NOT_ASSIGNED_YET,
  WHAT_IF_PAGE,
  carryRows,
  itemsSmall,
  projection,
  removeBody,
  whatIfView,
} from "@/lib/model/what-if";

// Task 4.10: the What-if items screen's pure parts (guide §5.10): the orders, the
// page, the projected total with its thread, and who would pay the extra.

const funders: Funder[] = [
  { id: "greg", name: "Greg" },
  { id: "bella", name: "Bella" },
  { id: "ck", name: "CK" },
];
const nameOf = (id: string | null) => funders.find((f) => f.id === id)?.name ?? "Not assigned";

const item = (id: string, over: Partial<OrderableWhatIf> = {}): OrderableWhatIf => ({
  id,
  name: id,
  totalPrice: 0,
  funder: null,
  category: "Other",
  createdAt: null,
  ...over,
});

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id);

describe("the orders", () => {
  it("offers the five orders, price starting with the biggest and the rest from the beginning", () => {
    expect(WHAT_IF_ORDERS.map((o) => o.label)).toEqual(["Order added", "Name", "Category", "Price", "Who would pay"]);
    expect(startDirection(WHAT_IF_ORDERS, "price")).toBe("desc");
    for (const key of ["added", "name", "category", "funder"]) expect(startDirection(WHAT_IF_ORDERS, key)).toBe("asc");
  });

  it("orders by when they were added, oldest first, with ones that have no date last", () => {
    const rows = [item("c", { createdAt: 300 }), item("none"), item("a", { createdAt: 100 }), item("b", { createdAt: 200 })];
    expect(ids(orderWhatIfs(rows, "added", "asc", nameOf))).toEqual(["a", "b", "c", "none"]);
    expect(ids(orderWhatIfs(rows, "added", "desc", nameOf))).toEqual(["c", "b", "a", "none"]);
  });

  it("orders by name the way a person reads it", () => {
    const rows = [item("x", { name: "Item 10" }), item("y", { name: "item 2" }), item("z", { name: "Álbum" })];
    expect(ids(orderWhatIfs(rows, "name", "asc", nameOf))).toEqual(["z", "y", "x"]);
  });

  it("orders by price, an item in parts counting as its parts added up", () => {
    const split: OrderableWhatIf = item("split", {
      totalPrice: 0,
      subEntries: [
        { id: "p1", name: "Part 1", totalPrice: 30_000_000 },
        { id: "p2", name: "Part 2", totalPrice: 25_000_000 },
      ],
    });
    const rows = [item("small", { totalPrice: 5_000_000 }), split, item("big", { totalPrice: 40_000_000 })];
    expect(ids(orderWhatIfs(rows, "price", "desc", nameOf))).toEqual(["split", "big", "small"]);
    expect(ids(orderWhatIfs(rows, "price", "asc", nameOf))).toEqual(["small", "big", "split"]);
  });

  it("orders by category, with items that have none last in both directions", () => {
    const rows = [item("m", { category: "Music/DJ" }), item("none", { category: "" }), item("d", { category: "Decoration" })];
    expect(ids(orderWhatIfs(rows, "category", "asc", nameOf))).toEqual(["d", "m", "none"]);
    expect(ids(orderWhatIfs(rows, "category", "desc", nameOf))).toEqual(["m", "d", "none"]);
  });

  it("orders by who would pay: the first part's funder by name, nobody yet last", () => {
    const rows = [
      item("nobody"),
      item("ck", { funder: "ck" }),
      item("greg", { funder: "greg" }),
      item("parts", {
        subEntries: [
          { id: "p1", name: "Part 1", totalPrice: 1, funder: "bella" },
          { id: "p2", name: "Part 2", totalPrice: 1, funder: "greg" },
        ],
      }),
    ];
    expect(ids(orderWhatIfs(rows, "funder", "asc", nameOf))).toEqual(["parts", "ck", "greg", "nobody"]);
    expect(ids(orderWhatIfs(rows, "funder", "desc", nameOf))).toEqual(["greg", "ck", "parts", "nobody"]);
  });

  it("breaks a tie by name, whichever way the list runs", () => {
    const rows = [item("b", { name: "Bands", totalPrice: 10 }), item("a", { name: "Arch", totalPrice: 10 })];
    expect(ids(orderWhatIfs(rows, "price", "desc", nameOf))).toEqual(["a", "b"]);
    expect(ids(orderWhatIfs(rows, "price", "asc", nameOf))).toEqual(["a", "b"]);
  });
});

describe("the page", () => {
  const many = Array.from({ length: 120 }, (_, i) => item(`w${String(i).padStart(3, "0")}`, { createdAt: i + 1 }));

  it("shows fifty at a time and says how many more come next", () => {
    const first = whatIfView(many, funders, { key: "added", direction: "asc" }, WHAT_IF_PAGE, WHAT_IF_PAGE);
    expect(first.shown).toBe(50);
    expect(first.more).toBe(50);
    expect(first.rows).toHaveLength(120);

    const last = whatIfView(many, funders, { key: "added", direction: "asc" }, 100, WHAT_IF_PAGE);
    expect(last.shown).toBe(100);
    expect(last.more).toBe(20);

    const all = whatIfView(many, funders, { key: "added", direction: "asc" }, 150, WHAT_IF_PAGE);
    expect(all.shown).toBe(120);
    expect(all.more).toBe(0);
  });

  it("names an unknown funder as Not assigned when ordering by who would pay", () => {
    const rows = [item("gone", { funder: "removed" }), item("greg", { funder: "greg" })];
    const view = whatIfView(rows, funders, { key: "funder", direction: "asc" }, 50, 50);
    expect(ids(view.rows)).toEqual(["greg", "gone"]);
  });
});

describe("the projected total", () => {
  it("adds the what-if items to what is committed, and says how much of the thread is committed", () => {
    expect(projection(300_000_000, 100_000_000)).toEqual({
      total: 400_000_000,
      committed: 300_000_000,
      whatIf: 100_000_000,
      share: 75,
      label: "75% committed, the rest what-if",
    });
  });

  it("is all what-if when nothing is committed, and has an empty thread when there is nothing at all", () => {
    expect(projection(0, 50_000_000).share).toBe(0);
    expect(projection(0, 0)).toMatchObject({ total: 0, share: 0 });
  });
});

describe("who would pay the extra", () => {
  const rec = (id: string, over: Partial<WhatIfRecord>): WhatIfRecord => ({ id, name: id, totalPrice: 0, funder: null, ...over });

  it("lists the biggest share first and puts nobody-yet in by its amount", () => {
    const items = [
      rec("a", { totalPrice: 10_000_000, funder: "greg" }),
      rec("b", { totalPrice: 40_000_000, funder: "bella" }),
      rec("c", { totalPrice: 25_000_000 }),
    ];
    const { rows, more } = carryRows(items, funders);
    expect(rows.map((r) => [r.label, r.amount])).toEqual([
      ["Bella", 40_000_000],
      [NOT_ASSIGNED_YET, 25_000_000],
      ["Greg", 10_000_000],
    ]);
    expect(more).toBe(0);
  });

  it("splits an item in parts across its funders", () => {
    const items = [
      rec("band", {
        subEntries: [
          { id: "p1", name: "Deposit", totalPrice: 10_000_000, funder: "greg" },
          { id: "p2", name: "Balance", totalPrice: 30_000_000, funder: "bella" },
        ],
      }),
    ];
    expect(carryRows(items, funders).rows.map((r) => [r.label, r.amount])).toEqual([
      ["Bella", 30_000_000],
      ["Greg", 10_000_000],
    ]);
  });

  it("shows eight funders and counts the rest", () => {
    const crowd: Funder[] = Array.from({ length: 11 }, (_, i) => ({ id: `f${i}`, name: `Funder ${i}` }));
    const items = crowd.map((f, i) => rec(`w${i}`, { totalPrice: (i + 1) * 1_000_000, funder: f.id }));
    const { rows, more } = carryRows(items, crowd);
    expect(rows).toHaveLength(CARRY_SHOWN);
    expect(more).toBe(3);
    expect(rows[0].label).toBe("Funder 10");
  });
});

describe("the words", () => {
  it("counts the items and says what leaves the projected total", () => {
    expect(itemsSmall(1)).toBe("1 item");
    expect(itemsSmall(301)).toBe("301 items");
    expect(removeBody(40_000_000)).toBe("Rp 40.000.000 comes off the projected total. You can undo for a few seconds.");
  });
});
