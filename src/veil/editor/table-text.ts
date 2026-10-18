import { plural } from "@/lib/model/format";

/**
 * The words and small rules of a document's table tools (guide §4.24 "Table
 * bar", §6.10). Pure, so they can be tested without an editor.
 */

/** The formula bar when the cell holds no total. */
export const FORMULA_HINT = "Type =SUM(B2:B6) for a total. B2:B keeps growing as rows are added.";

/** The table size pop before a size is pointed at. */
export const SIZE_PROMPT = "Choose a size";

/** The size pop's grid: 8 × 8. */
export const SIZE_GRID = 8;

/** "3 rows, 4 columns". */
export const sizeLabel = (rows: number, cols: number) => `${plural(rows, "row")}, ${plural(cols, "column")}`;

/** The toast after Remove table, with Undo. */
export const TABLE_REMOVED = "Removed the table";

/** Add [5] [rows/columns]: 1 to 50 at a time. */
export const ADD_MIN = 1;
export const ADD_MAX = 50;
export const ADD_START = 5;
export const ADD_HINT = "1 to 50 at a time";

/** What's typed in the Add box, as a count from 1 to 50 (anything else is 1). */
export function addCount(text: string): number {
  const n = parseInt(text, 10);
  if (!Number.isFinite(n)) return ADD_MIN;
  return Math.max(ADD_MIN, Math.min(ADD_MAX, n));
}

/** Narrower and Wider move a column by this many pixels, between these limits. */
export const WIDTH_STEP = 40;
export const WIDTH_MIN = 60;
export const WIDTH_MAX = 640;

/**
 * The column widths after Narrower or Wider on column `index`. Every column
 * keeps the width it has on screen, so only the one chosen changes.
 */
export function resizeColumn(widths: readonly number[], index: number, change: "narrower" | "wider"): number[] {
  return widths.map((w, i) => {
    const now = Math.round(w);
    if (i !== index) return now;
    const next = now + (change === "wider" ? WIDTH_STEP : -WIDTH_STEP);
    return Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, next));
  });
}

/** A new table from the size pop always has a title row and at least one row under it. */
export const newTableRows = (chosen: number) => Math.max(2, chosen);
