/**
 * Totals and sorting for tables inside documents (guide §6.10; R3, R4).
 *
 * The table is a grid of cell texts. Cells are addressed like a spreadsheet:
 * columns A, B, C…, rows counted from 1, including the title row. Only SUM works:
 *
 *   =SUM(B2:B6)    a range
 *   =SUM(B2, C4)   cells, separated by commas or semicolons
 *   =SUM(B2:B)     a growing range, down to the last row and stopping above the
 *                  total itself when the total sits in that column
 *   =SUM(B:B)      the same for a whole column, starting below the title row
 *
 * Case and spaces don't matter. Text and blanks count as 0. A range that runs
 * past the last row stops at it, as the old engine's did. This replaces
 * `components/notes/formulas.ts`, which stays with the old UI until it's deleted.
 */
import { group, plural } from "./format";
import { sortBy, type Direction } from "./order";

// ---------- addresses ----------

/** 0 → "A", 25 → "Z", 26 → "AA". */
export function columnName(index: number): string {
  let name = "";
  for (let k = index + 1; k > 0; k = Math.floor((k - 1) / 26)) name = String.fromCharCode(65 + ((k - 1) % 26)) + name;
  return name;
}

/** "A" → 0, "AA" → 26. */
export const columnIndex = (name: string) => [...name.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** The address of a cell, from zero-based row and column: (6, 1) → "B7". */
export const cellAddress = (row: number, column: number) => `${columnName(column)}${row + 1}`;

// ---------- reading numbers ----------

export interface ParsedNumber {
  value: number;
  /** Nothing in the cell, or only "Rp". */
  blank: boolean;
  /** Words, not a number. Counts as 0. */
  text: boolean;
  /** The cell says "Rp". */
  rp: boolean;
}

const SYMBOLS = /[$€£¥₹%]/g;

/**
 * Reads "Rp 12.500.000", "12.500.000", "12500000", "2,5", "1.5" and "-3".
 * A dot before exactly three digits is thousands and a comma is a decimal,
 * so "12.500" is 12500 and "2,5" is 2.5. "1,234.56" (a comma, then a point) is
 * read the English way.
 */
export function parseNumber(text: string): ParsedNumber {
  let t = String(text ?? "")
    .replace(/ /g, " ")
    .replace(/−/g, "-")
    .replace(SYMBOLS, "")
    .trim();
  const rp = /^-?\s*rp(?![a-z])/i.test(t);
  t = t.replace(/^(-?)\s*rp(?![a-z])\.?\s*/i, "$1").replace(/\s/g, "");
  if (!t) return { value: 0, blank: true, text: false, rp };
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return { value: parseFloat(t.replace(/\./g, "").replace(",", ".")), blank: false, text: false, rp };
  if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(t)) return { value: parseFloat(t.replace(/,/g, "")), blank: false, text: false, rp };
  if (/^-?\d+(,\d+)?$/.test(t)) return { value: parseFloat(t.replace(",", ".")), blank: false, text: false, rp };
  if (/^-?\d+(\.\d+)?$/.test(t)) return { value: parseFloat(t), blank: false, text: false, rp };
  return { value: 0, blank: false, text: true, rp };
}

/** A total as it's shown: "Rp 12.500.000", or "2,25" with a comma and decimals only when there are some. */
export function formatTotal(value: number, rp: boolean): string {
  const a = Math.round(Math.abs(value) * 100) / 100;
  const whole = Math.trunc(a);
  const cents = Math.round((a - whole) * 100);
  return (value < 0 && a > 0 ? "−" : "") + (rp ? "Rp " : "") + group(whole) + (cents ? "," + String(cents).padStart(2, "0") : "");
}

// ---------- totals ----------

export type FormulaErrorName = "Bad reference" | "Includes itself" | "Not a total";

export interface FormulaError {
  /** The short name drawn in the cell. */
  name: FormulaErrorName;
  /** The reason, for the formula bar and the cell's title. */
  reason: string;
}

export interface CellResult {
  /** The formula, when the cell holds a total. */
  formula: string | null;
  /** A total's value, or a plain number cell's value; otherwise `null`. */
  value: number | null;
  rp: boolean;
  /** What the cell shows: the total, the error's name, or the cell's own text. */
  display: string;
  error: FormulaError | null;
  /** A plain cell holding a number, which the screen right-aligns. */
  numeric: boolean;
}

export const isFormula = (text: string) => text.trim().startsWith("=");

class Failure extends Error {
  constructor(readonly info: FormulaError) {
    super(info.reason);
  }
}

const fail = (name: FormulaErrorName, reason: string) => new Failure({ name, reason });

const SUM = /^=\s*sum\s*\((.*)\)\s*$/i;

interface Amount {
  value: number;
  rp: boolean;
}

export interface EvaluateOptions {
  /** The first row is a title row. `B:B` starts below it. On by default. */
  titleRow?: boolean;
}

/** Works out every cell of the table. Rows may be different lengths. */
export function evaluateTable(cells: readonly (readonly string[])[], { titleRow = true }: EvaluateOptions = {}): CellResult[][] {
  const nrows = cells.length;
  const ncols = cells.reduce((m, row) => Math.max(m, row.length), 0);
  const done = new Map<string, Amount>();
  const failed = new Map<string, Failure>();

  const outside = (r: number, k: number) =>
    fail("Bad reference", `${cellAddress(r, k)} is outside this table, which has ${plural(ncols, "column")} and ${plural(nrows, "row")}.`);

  function valueAt(r: number, k: number, stack: string[]): Amount {
    const text = cells[r]?.[k];
    if (text === undefined) throw outside(r, k);
    if (isFormula(text)) return total(r, k, stack);
    const n = parseNumber(text);
    return { value: n.value, rp: n.rp };
  }

  function total(r: number, k: number, stack: string[]): Amount {
    const key = `${r}:${k}`;
    if (stack.includes(key)) {
      throw fail("Includes itself", `This total includes its own cell, ${cellAddress(r, k)}. Change the range so it stops above it.`);
    }
    const known = done.get(key);
    if (known) return known;
    const bad = failed.get(key);
    if (bad) throw bad;

    const match = SUM.exec((cells[r][k] as string).trim());
    if (!match) throw fail("Not a total", "Only SUM works here, like =SUM(B2:B6).");

    const inside = [...stack, key];
    let sum = 0;
    let rp = false;
    const add = (a: Amount) => {
      sum += a.value;
      rp = rp || a.rp;
    };

    for (const raw of match[1].split(/[,;]/)) {
      const arg = raw.replace(/\s+/g, "").toUpperCase();
      if (!arg) continue;
      let m: RegExpExecArray | null;
      if ((m = /^([A-Z]+)(\d+)$/.exec(arg))) {
        add(valueAt(Number(m[2]) - 1, columnIndex(m[1]), inside));
      } else if ((m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(arg))) {
        // Rows past the end are left off; a column that isn't there is an error.
        const [r1, r2] = [Number(m[2]), Number(m[4])].sort((a, z) => a - z).map((n) => n - 1);
        const [k1, k2] = [columnIndex(m[1]), columnIndex(m[3])].sort((a, z) => a - z);
        for (let rr = r1; rr <= Math.min(r2, nrows - 1); rr++) for (let kk = k1; kk <= k2; kk++) add(valueAt(rr, kk, inside));
      } else if ((m = /^([A-Z]+)(\d*):([A-Z]+)$/.exec(arg))) {
        const start = m[2] ? Number(m[2]) - 1 : titleRow ? 1 : 0;
        const [k1, k2] = [columnIndex(m[1]), columnIndex(m[3])].sort((a, z) => a - z);
        if (k2 >= ncols) throw fail("Bad reference", `Column ${columnName(k2)} isn't in this table, which has ${plural(ncols, "column")}.`);
        // A growing range runs to the last row, stopping above this total when the total is in its column.
        const last = k >= k1 && k <= k2 && r >= start - 1 ? r - 1 : nrows - 1;
        for (let rr = start; rr <= last; rr++) for (let kk = k1; kk <= k2; kk++) add(valueAt(rr, kk, inside));
      } else {
        throw fail("Bad reference", `“${arg}” isn't a cell or range. Use cells like B2 or ranges like B2:B6.`);
      }
    }

    const result = { value: sum, rp };
    done.set(key, result);
    return result;
  }

  return cells.map((row, r) =>
    row.map((text, k): CellResult => {
      if (!isFormula(text)) {
        const n = parseNumber(text);
        const numeric = !n.blank && !n.text;
        return { formula: null, value: numeric ? n.value : null, rp: n.rp, display: text, error: null, numeric };
      }
      const formula = text.trim();
      try {
        const a = total(r, k, []);
        return { formula, value: a.value, rp: a.rp, display: formatTotal(a.value, a.rp), error: null, numeric: false };
      } catch (e) {
        if (!(e instanceof Failure)) throw e;
        failed.set(`${r}:${k}`, e);
        return { formula, value: null, rp: false, display: e.info.name, error: e.info, numeric: false };
      }
    }),
  );
}

// ---------- sorting ----------

export interface SortOptions {
  /** The first row is a title row and stays first. On by default. */
  titleRow?: boolean;
}

/**
 * Sorts a table by one column (R3). Returns where each row goes: the new list
 * of original row numbers. It's numeric when every non-blank value in the
 * column is a number, and text otherwise (natural order, accents ignored).
 * Blanks go last. The title row and any row holding a total stay where they are.
 */
export function sortTableRows(
  cells: readonly (readonly string[])[],
  column: number,
  direction: Direction,
  { titleRow = true }: SortOptions = {},
): number[] {
  const order = cells.map((_, i) => i);
  const movable = order.filter((i) => !(titleRow && i === 0) && !cells[i].some(isFormula));
  const parsed = movable.map((i) => {
    const text = (cells[i][column] ?? "").trim();
    return { i, text, n: parseNumber(text) };
  });
  const numeric = parsed.filter((p) => !p.n.blank).every((p) => !p.n.text);
  const sorted = sortBy(parsed, (p) => (numeric ? (p.n.blank ? null : p.n.value) : p.text), direction);
  sorted.forEach((p, slot) => (order[movable[slot]] = p.i));
  return order;
}

/** Puts rows in the order `sortTableRows` gave. */
export const applyRowOrder = <T>(rows: readonly T[], order: readonly number[]): T[] => order.map((i) => rows[i]);
