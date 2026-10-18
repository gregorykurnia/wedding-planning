import { describe, expect, it } from "vitest";
import { getSchema, type JSONContent } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import { docExtensions } from "@/veil/editor/marks";
import { cellTexts, hasTitleRow, tableSpot } from "@/veil/editor/table-ops";
import { cellHere, decorate } from "@/veil/editor/totals";
import { addCount, newTableRows, resizeColumn, sizeLabel } from "@/veil/editor/table-text";

// Task 4.18: the table words and rules, and the cell drawings over a real
// document schema (no page needed).

const schema = getSchema(docExtensions());

const cell = (type: "tableHeader" | "tableCell", text: string): JSONContent => ({
  type,
  content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
});
const row = (type: "tableHeader" | "tableCell", ...texts: string[]): JSONContent => ({
  type: "tableRow",
  content: texts.map((t) => cell(type, t)),
});

const prices = (title = true) =>
  schema.nodeFromJSON({
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Prices" }] },
      {
        type: "table",
        content: [
          row(title ? "tableHeader" : "tableCell", "Item", "Price"),
          row("tableCell", "Flowers", "Rp 12.500.000"),
          row("tableCell", "Cake", "2.000.000"),
          row("tableCell", "Total", "=SUM(B2:B)"),
          row("tableCell", "Oops", "=SUM(B2, D9)"),
        ],
      },
    ],
  });

/** The position inside the paragraph of cell (r, k) of the first table. */
function inside(doc: ReturnType<typeof prices>, r: number, k: number): number {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found >= 0 || node.type.name !== "table") return found < 0;
    let p = pos + 1;
    for (let i = 0; i < r; i++) p += node.child(i).nodeSize;
    p += 1;
    for (let j = 0; j < k; j++) p += node.child(r).child(j).nodeSize;
    found = p + 2;
    return false;
  });
  return found;
}

const at = (doc: ReturnType<typeof prices>, pos: number) =>
  EditorState.create({ doc, selection: TextSelection.create(doc, pos) });

type Drawn = { from: number; attrs: Record<string, string> };
const drawn = (doc: ReturnType<typeof prices>, here = -1): Drawn[] =>
  decorate(doc, here)
    .find()
    .map((d) => ({ from: d.from, attrs: (d as unknown as { type: { attrs: Record<string, string> } }).type.attrs }));

describe("table words", () => {
  it("names a size", () => {
    expect(sizeLabel(3, 4)).toBe("3 rows, 4 columns");
    expect(sizeLabel(1, 1)).toBe("1 row, 1 column");
  });

  it("reads the Add box as 1 to 50", () => {
    expect(addCount("5")).toBe(5);
    expect(addCount("80")).toBe(50);
    expect(addCount("0")).toBe(1);
    expect(addCount("")).toBe(1);
    expect(addCount("abc")).toBe(1);
  });

  it("keeps a title row and a row under it in a new table", () => {
    expect(newTableRows(1)).toBe(2);
    expect(newTableRows(5)).toBe(5);
  });

  it("changes one column's width and keeps the others", () => {
    expect(resizeColumn([170.4, 170.4, 170.4], 1, "wider")).toEqual([170, 210, 170]);
    expect(resizeColumn([170, 80, 170], 1, "narrower")).toEqual([170, 60, 170]);
    expect(resizeColumn([170, 630], 1, "wider")).toEqual([170, 640]);
  });
});

describe("the table at the cursor", () => {
  it("finds the cell's row and column", () => {
    const doc = prices();
    const spot = tableSpot(at(doc, inside(doc, 3, 1)));
    expect(spot && { row: spot.row, col: spot.col }).toEqual({ row: 3, col: 1 });
    expect(tableSpot(at(doc, 2))).toBeNull();
  });

  it("reads the texts and the title row", () => {
    const doc = prices();
    const spot = tableSpot(at(doc, inside(doc, 0, 0)))!;
    expect(cellTexts(spot.table)[3]).toEqual(["Total", "=SUM(B2:B)"]);
    expect(hasTitleRow(spot.table)).toBe(true);
    const plain = prices(false);
    expect(hasTitleRow(tableSpot(at(plain, inside(plain, 0, 0)))!.table)).toBe(false);
  });
});

describe("cell drawings", () => {
  it("draws a total in place of its formula, with its address and formula as the title", () => {
    const doc = prices();
    const total = drawn(doc).find((d) => d.attrs["data-cell"] === "total")!;
    expect(total.attrs["data-total"]).toBe("Rp 14.500.000");
    expect(total.attrs.title).toBe("B4 =SUM(B2:B)");
  });

  it("names an error, with the reason as the title", () => {
    const doc = prices();
    const error = drawn(doc).find((d) => d.attrs["data-cell"] === "error")!;
    expect(error.attrs["data-total"]).toBe("Bad reference");
    expect(error.attrs.title).toBe("D9 is outside this table, which has 2 columns and 5 rows.");
  });

  it("right-aligns numbers below the title row only", () => {
    const doc = prices();
    expect(drawn(doc).filter((d) => d.attrs["data-cell"] === "number")).toHaveLength(2);
  });

  it("shows the formula of the total holding the cursor, and rings that cell", () => {
    const doc = prices();
    const state = at(doc, inside(doc, 3, 1));
    const here = cellHere(state);
    const mine = drawn(doc, here).find((d) => d.from === here)!;
    expect(mine.attrs["data-cell"]).toBe("editing");
    expect(mine.attrs).toHaveProperty("data-here");
    expect(mine.attrs["data-total"]).toBeUndefined();
  });

  it("rings a plain cell without changing how it's drawn", () => {
    const doc = prices();
    const here = cellHere(at(doc, inside(doc, 1, 0)));
    expect(drawn(doc, here).find((d) => d.from === here)?.attrs).toEqual({ "data-here": "" });
  });
});
