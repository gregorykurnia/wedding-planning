import { describe, expect, it } from "vitest";
import {
  applyRowOrder,
  cellAddress,
  columnIndex,
  columnName,
  evaluateTable,
  formatTotal,
  isFormula,
  parseNumber,
  sortTableRows,
} from "@/lib/model/formulas";

describe("addresses", () => {
  it("names columns like a spreadsheet", () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
    expect(["A", "B", "z", "AA", "AZ", "ZZ", "AAA"].map(columnIndex)).toEqual([0, 1, 25, 26, 51, 701, 702]);
    expect(cellAddress(6, 1)).toBe("B7");
    expect(cellAddress(0, 0)).toBe("A1");
  });
});

describe("parseNumber", () => {
  const v = (t: string) => parseNumber(t).value;

  it("reads rupiah with dots", () => {
    expect(parseNumber("Rp 12.500.000")).toEqual({ value: 12_500_000, blank: false, text: false, rp: true });
    expect(v("12.500.000")).toBe(12_500_000);
    expect(v("12500000")).toBe(12_500_000);
    expect(v("Rp12.500.000")).toBe(12_500_000);
    expect(v("rp. 12.500.000")).toBe(12_500_000);
    expect(v("RP 1.000")).toBe(1000);
    expect(v("12.500")).toBe(12_500);
  });

  it("reads a decimal comma and a decimal point", () => {
    expect(v("2,5")).toBe(2.5);
    expect(v("1.234.567,25")).toBe(1_234_567.25);
    expect(v("1.5")).toBe(1.5);
    expect(v("0,75")).toBe(0.75);
  });

  it("reads the English way when a comma is followed by a point", () => {
    expect(v("1,234.56")).toBe(1234.56);
    expect(v("1,234,567.5")).toBe(1_234_567.5);
  });

  it("reads negatives, with a hyphen or a true minus, before or after Rp", () => {
    expect(v("-3")).toBe(-3);
    expect(v("−3")).toBe(-3);
    expect(v("−Rp 12.000.000")).toBe(-12_000_000);
    expect(v("-Rp 5.000")).toBe(-5000);
    expect(v("Rp -5.000")).toBe(-5000);
    expect(parseNumber("−Rp 12.000.000").rp).toBe(true);
  });

  it("ignores spaces, non-breaking spaces and currency signs", () => {
    expect(v("  Rp 12.500.000 ")).toBe(12_500_000);
    expect(v("12 500 000")).toBe(12_500_000);
    expect(v("$100")).toBe(100);
    expect(v("€2,5")).toBe(2.5);
    expect(v("5%")).toBe(5);
  });

  it("calls an empty cell, or only Rp, blank", () => {
    expect(parseNumber("")).toEqual({ value: 0, blank: true, text: false, rp: false });
    expect(parseNumber("   ")).toMatchObject({ blank: true });
    expect(parseNumber("Rp")).toEqual({ value: 0, blank: true, text: false, rp: true });
    expect(parseNumber("Rp.")).toMatchObject({ blank: true, rp: true });
  });

  it("calls words text, worth 0", () => {
    expect(parseNumber("Fireworks")).toEqual({ value: 0, blank: false, text: true, rp: false });
    expect(parseNumber("TBD")).toMatchObject({ text: true });
    expect(parseNumber("12.5.3")).toMatchObject({ text: true });
    expect(parseNumber("1,2,3")).toMatchObject({ text: true });
    expect(parseNumber("Rpm")).toMatchObject({ text: true, rp: false });
    expect(parseNumber("婚礼")).toMatchObject({ text: true });
  });
});

describe("formatTotal", () => {
  it("groups with dots and shows decimals only when there are some", () => {
    expect(formatTotal(97_000_000, false)).toBe("97.000.000");
    expect(formatTotal(97_000_000, true)).toBe("Rp 97.000.000");
    expect(formatTotal(2.5, false)).toBe("2,50");
    expect(formatTotal(2.25, false)).toBe("2,25");
    expect(formatTotal(0.05, false)).toBe("0,05");
    expect(formatTotal(0, false)).toBe("0");
  });

  it("rounds to two decimals without carrying a bad cent", () => {
    expect(formatTotal(0.1 + 0.2, false)).toBe("0,30");
    expect(formatTotal(1.999, false)).toBe("2");
    expect(formatTotal(1234.5678, false)).toBe("1.234,57");
  });

  it("puts a true minus first", () => {
    expect(formatTotal(-12_000_000, true)).toBe("−Rp 12.000.000");
    expect(formatTotal(-2.5, false)).toBe("−2,50");
    expect(formatTotal(-0.001, false)).toBe("0");
  });

  it("holds 13-digit totals", () => {
    expect(formatTotal(9_876_543_000_000, true)).toBe("Rp 9.876.543.000.000");
  });
});

const grid = (rows: string[]) => rows.map((r) => r.split("|").map((c) => c.trim()));
const shown = (cells: string[][], opts?: Parameters<typeof evaluateTable>[1]) => evaluateTable(cells, opts).map((row) => row.map((c) => c.display));

describe("evaluateTable: totals", () => {
  const prices = grid([
    "Idea | Cost",
    "Fireworks | 25000000",
    "Live band | 30000000",
    "Welcome dinner | 42000000",
    "Total | =SUM(B2:B4)",
  ]);

  it("adds a range", () => {
    expect(shown(prices)[4][1]).toBe("97.000.000");
    expect(evaluateTable(prices)[4][1]).toMatchObject({ formula: "=SUM(B2:B4)", value: 97_000_000, rp: false, error: null });
  });

  it("adds cells separated by commas or semicolons", () => {
    const t = grid(["A | B | C", "1 | 2 | 3", "10 | 20 | 30", "=SUM(A2, C3) | =SUM(A2; B3; C2) | x"]);
    expect(shown(t)[3].slice(0, 2)).toEqual(["31", "24"]);
  });

  it("adds a rectangle of cells", () => {
    const t = grid(["a | b", "1 | 2", "3 | 4", "=SUM(A2:B3) | "]);
    expect(shown(t)[3][0]).toBe("10");
  });

  it("ignores case and spaces", () => {
    const t = grid(["h | h", "5 | 6", "=sum ( b2 : b3 , A2 ) | "]);
    expect(shown(t)[2][0]).toBe("11");
    expect(shown(grid(["h", "4", "= SUM(A2:A2)"]))[2][0]).toBe("4");
  });

  it("reads a range written backwards", () => {
    expect(shown(prices.map((r, i) => (i === 4 ? ["Total", "=SUM(B4:B2)"] : r)))[4][1]).toBe("97.000.000");
  });

  it("stops a range at the last row instead of failing, as the old engine did", () => {
    const t = grid(["h | x", "1 | ", "2 | ", " | =SUM(A2:A99)"]);
    expect(shown(t)[3][1]).toBe("3");
  });

  it("grows a range as rows are added, stopping above the total", () => {
    const t = grid(["Idea | Cost", "a | 10", "b | 20", "Total | =SUM(B2:B)"]);
    expect(shown(t)[3][1]).toBe("30");
    const more = [...t.slice(0, 3), ["c", "5"], ["d", "Rp 100"], t[3]];
    expect(shown(more)[5][1]).toBe("Rp 135");
  });

  it("lets a growing range run past a total that sits in another column", () => {
    const t = grid(["h | h", "a | 10", "b | 20", "c | =SUM(B2:B)", "d | 40"]);
    // The total is in column B at row 4: it stops above itself and doesn't see row 5.
    expect(shown(t)[3][1]).toBe("30");
    const other = grid(["h | h | h", "a | 10 | 1", "b | 20 | 2", "c | 30 | =SUM(B2:B)"]);
    expect(shown(other)[3][2]).toBe("60");
  });

  it("starts a whole-column total below the title row", () => {
    const t = grid(["2027 | h", "a | 10", "b | 20", "Total | =SUM(B:B)"]);
    expect(shown(t)[3][1]).toBe("30");
    expect(shown(t, { titleRow: false })[3][1]).toBe("30");
    const numberTitle = grid(["100", "1", "2", "=SUM(A:A)"]);
    expect(shown(numberTitle)[3][0]).toBe("3");
    expect(shown(numberTitle, { titleRow: false })[3][0]).toBe("103");
  });

  it("counts text and blanks as 0", () => {
    const t = grid(["h", "Fireworks", "", "5", "=SUM(A2:A4)"]);
    expect(shown(t)[4][0]).toBe("5");
  });

  it("carries Rp into the total when any added cell has it", () => {
    const t = grid(["h", "Rp 1.000.000", "2000000", "=SUM(A2:A3)"]);
    expect(evaluateTable(t)[3][0]).toMatchObject({ value: 3_000_000, rp: true, display: "Rp 3.000.000" });
    expect(shown(grid(["h", "1", "2", "=SUM(A2:A3)"]))[3][0]).toBe("3");
  });

  it("shows decimals only when they aren't zero", () => {
    expect(shown(grid(["h", "2,5", "0,25", "=SUM(A2:A3)"]))[3][0]).toBe("2,75");
    expect(shown(grid(["h", "1,5", "1,5", "=SUM(A2:A3)"]))[3][0]).toBe("3");
  });

  it("adds a total that refers to other totals", () => {
    const t = grid(["h", "10", "20", "=SUM(A2:A3)", "5", "=SUM(A4, A5)"]);
    expect(shown(t)[5][0]).toBe("35");
  });

  it("marks plain numbers so the screen can right-align them", () => {
    const [header, row] = evaluateTable(grid(["Idea | Cost", "Fireworks | 25000000"]));
    expect(header[1].numeric).toBe(false);
    expect(row[0]).toMatchObject({ numeric: false, value: null, formula: null, display: "Fireworks" });
    expect(row[1]).toMatchObject({ numeric: true, value: 25_000_000, display: "25000000" });
  });

  it("leaves a table without formulas as it is, and an empty table empty", () => {
    expect(shown(grid(["a | b", "1 | 2"]))).toEqual([["a", "b"], ["1", "2"]]);
    expect(evaluateTable([])).toEqual([]);
    expect(evaluateTable([[]])).toEqual([[]]);
  });

  it("recognises a formula by its leading =", () => {
    expect(isFormula("=SUM(A1)")).toBe(true);
    expect(isFormula("  =SUM(A1)")).toBe(true);
    expect(isFormula("SUM(A1)")).toBe(false);
    expect(isFormula("")).toBe(false);
  });

  it("copes with a table whose rows are different lengths", () => {
    const t = [["h", "h"], ["a"], ["b", "7"], ["Total", "=SUM(B2:B3)"]];
    expect(() => evaluateTable(t)).not.toThrow();
    expect(evaluateTable(t)[3][1].error?.name).toBe("Bad reference");
  });
});

describe("evaluateTable: the three named errors", () => {
  const scratch = grid([
    "Idea | Cost",
    "Fireworks | 25000000",
    "Live band | 30000000",
    "Welcome dinner | 42000000",
    "Everything above | =SUM(B2:B4)",
    "Typo check | =SUM(B2:B4, D9)",
    "Loop check | =SUM(B2:B5, B7)",
  ]);

  it("handles the budget scratchpad from the design", () => {
    const r = evaluateTable(scratch);
    expect(r[4][1]).toMatchObject({ display: "97.000.000", error: null });
    expect(r[5][1]).toMatchObject({ display: "Bad reference", value: null });
    expect(r[5][1].error?.reason).toBe("D9 is outside this table, which has 2 columns and 7 rows.");
    expect(r[6][1]).toMatchObject({ display: "Includes itself", value: null });
    expect(r[6][1].error?.reason).toBe("This total includes its own cell, B7. Change the range so it stops above it.");
  });

  it("names a bad reference for text that isn't a cell or range", () => {
    const t = grid(["h", "1", "=SUM(x)"]);
    const e = evaluateTable(t)[2][0].error;
    expect(e).toEqual({ name: "Bad reference", reason: "“X” isn't a cell or range. Use cells like B2 or ranges like B2:B6." });
    expect(evaluateTable(grid(["h", "=SUM(5)"]))[1][0].error?.name).toBe("Bad reference");
    expect(evaluateTable(grid(["h", "=SUM(B2:6)"]))[1][0].error?.name).toBe("Bad reference");
  });

  it("names a column that isn't there, in a range and in a growing range", () => {
    const t = grid(["a | b", "1 | 2", "=SUM(C2:C) | =SUM(A2:C3)"]);
    const r = evaluateTable(t);
    expect(r[2][0].error?.reason).toBe("Column C isn't in this table, which has 2 columns.");
    expect(r[2][1].error?.reason).toBe("C2 is outside this table, which has 2 columns and 3 rows.");
  });

  it("says '1 column' and '1 row' when there's only one", () => {
    expect(evaluateTable([["=SUM(B1)"]])[0][0].error?.reason).toBe("B1 is outside this table, which has 1 column and 1 row.");
  });

  it("reads row 0 as outside the table", () => {
    expect(evaluateTable(grid(["h", "=SUM(A0)"]))[1][0].error?.reason).toBe("A0 is outside this table, which has 1 column and 2 rows.");
  });

  it("names a total that includes itself, directly or in a loop", () => {
    const direct = evaluateTable(grid(["h", "1", "=SUM(A2:A3)"]));
    expect(direct[2][0].error).toEqual({
      name: "Includes itself",
      reason: "This total includes its own cell, A3. Change the range so it stops above it.",
    });
    const loop = evaluateTable(grid(["h", "=SUM(A3)", "=SUM(A2)"]));
    expect(loop[1][0].error?.name).toBe("Includes itself");
    expect(loop[2][0].error?.name).toBe("Includes itself");
  });

  it("names a formula that isn't a total", () => {
    for (const f of ["=A2+A3", "=", "=AVERAGE(A2:A3)", "=SUM", "=SUM(A2:A3"]) {
      const e = evaluateTable(grid(["h", "1", "2"]).concat([[f]]))[3][0].error;
      expect(e).toEqual({ name: "Not a total", reason: "Only SUM works here, like =SUM(B2:B6)." });
    }
  });

  it("passes a mistake on to a total that adds it up", () => {
    const bad = grid(["h | x", "=OOPS | 5", "2 | 6", "=SUM(A2:A3) | =SUM(B2:B3)"]);
    const r = evaluateTable(bad);
    expect(r[3][0]).toMatchObject({ display: "Not a total", error: { name: "Not a total" } });
    expect(r[3][1]).toMatchObject({ display: "11", error: null });
  });

  it("keeps working cells working next to a broken one", () => {
    const r = evaluateTable(scratch);
    expect(r.flat().filter((c) => c.error)).toHaveLength(2);
    expect(r[4][1].value).toBe(97_000_000);
  });

  it("doesn't blow the stack on a long chain of totals", () => {
    const rows: string[][] = [["h"], ["1"]];
    for (let i = 3; i <= 400; i++) rows.push([`=SUM(A${i - 1})`]);
    expect(evaluateTable(rows)[399][0].display).toBe("1");
  });
});

describe("evaluateTable: the stress table", () => {
  it("evaluates a 50 × 8 table with a total in every column", () => {
    const rows: string[][] = [Array.from({ length: 8 }, (_, k) => `Col ${k + 1}`)];
    for (let r = 1; r < 49; r++) rows.push(Array.from({ length: 8 }, (_, k) => String(r * (k + 1) * 1000)));
    rows.push(Array.from({ length: 8 }, (_, k) => `=SUM(${columnName(k)}2:${columnName(k)})`));
    const result = evaluateTable(rows);
    expect(result).toHaveLength(50);
    // 1000 × (1 + 2 + … + 48) = 1.176.000 for column A; column k is that times (k + 1).
    expect(result[49].map((c) => c.value)).toEqual(Array.from({ length: 8 }, (_, k) => 1_176_000 * (k + 1)));
    expect(result[49][0].display).toBe("1.176.000");
    expect(result.flat().some((c) => c.error)).toBe(false);
  });

  it("handles 50 rows × 8 columns of totals that all refer to each other in a chain", () => {
    const rows: string[][] = [];
    for (let r = 0; r < 50; r++) rows.push(Array.from({ length: 8 }, (_, k) => (r === 0 ? "1" : `=SUM(${columnName(k)}${r})`)));
    const result = evaluateTable(rows);
    expect(result[49][7].display).toBe("1");
    expect(result.flat().some((c) => c.error)).toBe(false);
  });
});

describe("sortTableRows", () => {
  const sorted = (cells: string[][], column: number, direction: "asc" | "desc", opts?: Parameters<typeof sortTableRows>[3]) =>
    applyRowOrder(cells, sortTableRows(cells, column, direction, opts)).map((r) => r[0]);

  it("sorts a numeric column numerically, ascending and descending", () => {
    const t = grid(["Idea | Cost", "b | 30000000", "a | 5", "c | 250", "d | 1.000"]);
    expect(sorted(t, 1, "asc")).toEqual(["Idea", "a", "c", "d", "b"]);
    expect(sorted(t, 1, "desc")).toEqual(["Idea", "b", "d", "c", "a"]);
  });

  it("reads Rp and decimal commas as numbers", () => {
    const t = grid(["h | h", "x | Rp 12.500.000", "y | 2,5", "z | Rp 900"]);
    expect(sorted(t, 1, "asc")).toEqual(["h", "y", "z", "x"]);
  });

  it("falls back to text when any value is not a number", () => {
    const t = grid(["h | h", "x | 10", "y | 9", "z | TBD"]);
    expect(sorted(t, 1, "asc")).toEqual(["h", "y", "x", "z"].map((n) => n));
  });

  it("sorts text naturally, ignoring case and accents", () => {
    const t = grid(["Name | Note", "Item 10 | x", "item 2 | x", "Élan | x", "Eagle | x", "Zed | x"]);
    expect(sorted(t, 0, "asc")).toEqual(["Name", "Eagle", "Élan", "item 2", "Item 10", "Zed"]);
    expect(sorted(t, 0, "desc")).toEqual(["Name", "Zed", "Item 10", "item 2", "Élan", "Eagle"]);
  });

  it("puts blanks last in both directions", () => {
    const t = grid(["h | h", "a | ", "b | 3", "c | 1", "d | "]);
    expect(sorted(t, 1, "asc")).toEqual(["h", "c", "b", "a", "d"]);
    expect(sorted(t, 1, "desc")).toEqual(["h", "b", "c", "a", "d"]);
    const text = grid(["h | h", "a | ", "b | zed", "c | amy"]);
    expect(sorted(text, 1, "asc")).toEqual(["h", "c", "b", "a"]);
    expect(sorted(text, 1, "desc")).toEqual(["h", "b", "c", "a"]);
  });

  it("keeps the title row and any row holding a total where they are", () => {
    const t = grid(["Idea | Cost", "b | 30", "a | 5", "Subtotal | =SUM(B2:B3)", "c | 20", "d | 10", "Total | =SUM(B2:B)"]);
    const order = sortTableRows(t, 1, "asc");
    expect(order[0]).toBe(0);
    expect(order[3]).toBe(3);
    expect(order[6]).toBe(6);
    expect(applyRowOrder(t, order).map((r) => r[0])).toEqual(["Idea", "a", "d", "Subtotal", "c", "b", "Total"]);
  });

  it("holds a total in a different column than the one sorted", () => {
    const t = grid(["h | h | h", "b | 2 | 1", "Total | 9 | =SUM(C2:C)", "a | 1 | 2"]);
    expect(sorted(t, 1, "asc")).toEqual(["h", "a", "Total", "b"]);
  });

  it("sorts every row when there's no title row", () => {
    const t = grid(["b | 2", "a | 1"]);
    expect(sorted(t, 0, "asc", { titleRow: false })).toEqual(["a", "b"]);
    expect(sorted(t, 0, "asc")).toEqual(["b", "a"]);
  });

  it("keeps rows that tie in the order they were in, both ways", () => {
    const t = grid(["h | h", "x | 1", "y | 1", "z | 1"]);
    expect(sorted(t, 1, "asc")).toEqual(["h", "x", "y", "z"]);
    expect(sorted(t, 1, "desc")).toEqual(["h", "x", "y", "z"]);
  });

  it("returns a permutation, and leaves a one-row or empty table alone", () => {
    const t = grid(["h | h", "b | 2", "a | 1"]);
    expect([...sortTableRows(t, 1, "asc")].sort()).toEqual([0, 1, 2]);
    expect(sortTableRows([], 0, "asc")).toEqual([]);
    expect(sortTableRows(grid(["h"]), 0, "desc")).toEqual([0]);
    expect(sortTableRows(grid(["h", "a"]), 0, "desc")).toEqual([0, 1]);
  });

  it("treats a row too short to have the column as blank", () => {
    const t = [["h", "h"], ["a"], ["b", "1"]];
    expect(applyRowOrder(t, sortTableRows(t, 1, "asc")).map((r) => r[0])).toEqual(["h", "b", "a"]);
  });

  it("sorts non-Latin text without losing a row", () => {
    const t = grid(["h", "婚礼", "Zed", "استوديو", "Abe"]);
    const out = sorted(t, 0, "asc");
    expect(out).toHaveLength(5);
    expect(out[0]).toBe("h");
    expect(out.indexOf("Abe")).toBeLessThan(out.indexOf("Zed"));
  });

  it("sorts a 50 × 8 table and leaves its total row last", () => {
    const rows: string[][] = [Array.from({ length: 8 }, (_, k) => `Col ${k + 1}`)];
    for (let r = 1; r < 49; r++) rows.push(Array.from({ length: 8 }, (_, k) => String(((r * 37 + k * 11) % 97) * 1000)));
    rows.push(Array.from({ length: 8 }, (_, k) => `=SUM(${columnName(k)}2:${columnName(k)})`));
    const order = sortTableRows(rows, 3, "desc");
    expect(order[0]).toBe(0);
    expect(order[49]).toBe(49);
    expect([...order].sort((a, z) => a - z)).toEqual(rows.map((_, i) => i));
    const values = order.slice(1, 49).map((i) => Number(rows[i][3]));
    expect(values).toEqual([...values].sort((a, z) => z - a));
    // The total still adds the same numbers after the move.
    const moved = applyRowOrder(rows, order);
    expect(evaluateTable(moved)[49][3].value).toBe(evaluateTable(rows)[49][3].value);
  });

  it("keeps a growing total correct after sorting", () => {
    const t = grid(["Idea | Cost", "b | 30", "a | 5", "c | 20", "Total | =SUM(B2:B)"]);
    const moved = applyRowOrder(t, sortTableRows(t, 1, "desc"));
    expect(evaluateTable(moved)[4][1].value).toBe(55);
  });
});
