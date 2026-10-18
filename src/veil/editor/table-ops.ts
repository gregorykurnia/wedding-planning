import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection, type EditorState } from "@tiptap/pm/state";
import { sortTableRows } from "@/lib/model/formulas";
import type { Direction } from "@/lib/model/order";
import { resizeColumn } from "./table-text";

/**
 * Reading and changing the table that holds the cursor (guide §4.24, R2, R3).
 * Totals are the cell's own text ("=SUM(B2:B)"), stored as the old editor
 * stored them; `totals.ts` only draws them.
 */

/** Where the cursor is in a table: the table, its position, and the cell's row and column (from 0). */
export interface TableSpot {
  table: PMNode;
  /** The position just before the table. */
  pos: number;
  row: number;
  col: number;
}

const roleOf = (node: PMNode) => node.type.spec.tableRole as string | undefined;

export function tableSpot(state: EditorState): TableSpot | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if (roleOf($from.node(d)) !== "table") continue;
    // The table's row, then the row's cell, sit one and two levels down.
    if ($from.depth < d + 2) return null;
    return { table: $from.node(d), pos: $from.before(d), row: $from.index(d), col: $from.index(d + 1) };
  }
  return null;
}

/** Each cell's text, row by row. */
export function cellTexts(table: PMNode): string[][] {
  const rows: string[][] = [];
  table.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) => cells.push(cell.textContent));
    rows.push(cells);
  });
  return rows;
}

/** The first row is a title row when every cell in it is a header cell. */
export function hasTitleRow(table: PMNode): boolean {
  const first = table.firstChild;
  if (!first || first.childCount === 0) return false;
  let all = true;
  first.forEach((cell) => {
    if (roleOf(cell) !== "header_cell") all = false;
  });
  return all;
}

/** The position just inside cell (row, col) of the table at `tablePos`. */
function cellInside(table: PMNode, tablePos: number, row: number, col: number): number {
  let pos = tablePos + 1;
  for (let r = 0; r < row; r++) pos += table.child(r).nodeSize;
  const tr = table.child(row);
  pos += 1;
  for (let k = 0; k < col; k++) pos += tr.child(k).nodeSize;
  return pos + 1;
}

/** Replaces the table and puts the cursor at the end of the text in (row, col). */
function replaceTable(editor: Editor, spot: TableSpot, next: PMNode, row: number, col: number) {
  const { state } = editor;
  const tr = state.tr.replaceWith(spot.pos, spot.pos + spot.table.nodeSize, next);
  const r = Math.min(row, next.childCount - 1);
  const c = Math.min(col, next.child(r).childCount - 1);
  const inside = cellInside(next, spot.pos, r, c);
  const end = inside + next.child(r).child(c).content.size;
  tr.setSelection(TextSelection.near(tr.doc.resolve(end), -1));
  editor.view.dispatch(tr.scrollIntoView());
  editor.commands.focus();
}

/**
 * Sort by the cursor's column (R3, guide §6.10): numbers numerically, text in
 * natural order, blanks last; the title row and rows holding totals stay put.
 */
export function sortTable(editor: Editor, direction: Direction) {
  const spot = tableSpot(editor.state);
  if (!spot) return;
  const order = sortTableRows(cellTexts(spot.table), spot.col, direction, { titleRow: hasTitleRow(spot.table) });
  if (order.every((from, to) => from === to)) return;
  const rows: PMNode[] = order.map((i) => spot.table.child(i));
  replaceTable(editor, spot, spot.table.type.create(spot.table.attrs, rows, spot.table.marks), spot.row, spot.col);
}

/** Adds `count` blank rows under the cursor's row, or columns to its right. */
export function addMany(editor: Editor, what: "rows" | "columns", count: number) {
  editor.commands.focus();
  // One at a time: in a single chain the table commands read stale positions.
  for (let i = 0; i < count; i++) {
    if (what === "rows") editor.commands.addRowAfter();
    else editor.commands.addColumnAfter();
  }
}

/** Row Above: above the title row there's no room, so the row goes under it. */
export function addRowAbove(editor: Editor) {
  const spot = tableSpot(editor.state);
  if (!spot) return;
  const chain = editor.chain().focus();
  (spot.row === 0 && hasTitleRow(spot.table) ? chain.addRowAfter() : chain.addRowBefore()).run();
}

/** The columns' widths as drawn, in pixels, read from the page. */
function drawnWidths(editor: Editor, spot: TableSpot): number[] {
  const fallback = () => {
    const widths: number[] = [];
    spot.table.firstChild?.forEach((cell) => widths.push((cell.attrs.colwidth as number[] | null)?.[0] ?? 160));
    return widths;
  };
  const dom = editor.view.nodeDOM(spot.pos);
  const el = dom instanceof HTMLElement ? (dom.matches("table") ? dom : dom.querySelector("table")) : null;
  const first = el?.querySelector("tr");
  if (!first) return fallback();
  const widths = [...first.children].map((c) => c.getBoundingClientRect().width);
  return widths.every((w) => w > 0) ? widths : fallback();
}

/**
 * Narrower and Wider (guide §4.24): the chosen column moves by a step; every
 * other column keeps the width it has now. Widths are stored on the cells as
 * `colwidth`, as the old editor's column resizing stored them.
 */
export function changeWidth(editor: Editor, change: "narrower" | "wider") {
  const spot = tableSpot(editor.state);
  if (!spot) return;
  const widths = resizeColumn(drawnWidths(editor, spot), spot.col, change);
  const tr = editor.state.tr;
  let rowPos = spot.pos + 1;
  spot.table.forEach((row) => {
    let cellPos = rowPos + 1;
    row.forEach((cell, _, k) => {
      if (k < widths.length && cell.attrs.colspan === 1) {
        tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, colwidth: [widths[k]] });
      }
      cellPos += cell.nodeSize;
    });
    rowPos += row.nodeSize;
  });
  editor.view.dispatch(tr);
  editor.commands.focus();
}

/**
 * Remove table, keeping what's needed to put it back: the table and a position
 * that follows later changes, so Undo puts it where it was.
 */
export function removeTable(editor: Editor): (() => void) | null {
  const spot = tableSpot(editor.state);
  if (!spot) return null;
  const saved = spot.table.toJSON();
  let at = spot.pos;
  const follow = ({ transaction }: { transaction: { mapping: { map: (pos: number) => number } } }) => {
    at = transaction.mapping.map(at);
  };
  if (!editor.chain().focus().deleteTable().run()) return null;
  editor.on("transaction", follow);
  // Long after the toast has gone, stop following.
  const stop = setTimeout(() => editor.off("transaction", follow), 60_000);
  return () => {
    clearTimeout(stop);
    editor.off("transaction", follow);
    if (editor.isDestroyed) return;
    const pos = Math.min(at, editor.state.doc.content.size);
    editor.chain().insertContentAt(pos, saved).run();
  };
}
