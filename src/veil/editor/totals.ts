import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { cellAddress, evaluateTable } from "@/lib/model/formulas";
import { cellTexts, hasTitleRow } from "./table-ops";

/**
 * Totals in document tables (guide §4.24 "Table cells", §6.10, R4). A total is
 * stored as the cell's own text, "=SUM(B2:B)", exactly as the old editor
 * stored it; this only draws it. Each cell gets a `data-cell`:
 *
 * - `total`: the worked-out amount, in `data-total`, drawn over the formula;
 * - `error`: the error's name ("Bad reference") in `data-total`, the reason in
 *   the cell's title;
 * - `editing`: the total holding the cursor, which shows its formula;
 * - `number`: a plain number, right-aligned.
 *
 * The cell holding the cursor also gets `data-here`, for the rose ring.
 */

type CellAttrs = Record<string, string>;

interface TotalsState {
  /** The position of the cell holding the cursor, or -1. */
  here: number;
  set: DecorationSet;
}

const key = new PluginKey<TotalsState>("veilTableTotals");

/** The position just before the cell holding the cursor, or -1. */
export function cellHere(state: EditorState): number {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const role = $from.node(d).type.spec.tableRole;
    if (role === "cell" || role === "header_cell") return $from.before(d);
  }
  return -1;
}

function decorateTable(table: PMNode, pos: number, here: number, out: Decoration[]) {
  const title = hasTitleRow(table);
  const results = evaluateTable(cellTexts(table), { titleRow: title });
  let rowPos = pos + 1;
  table.forEach((row, _, r) => {
    let cellPos = rowPos + 1;
    row.forEach((cell, __, k) => {
      const result = results[r][k];
      const attrs: CellAttrs = {};
      if (result.formula !== null) {
        if (cellPos === here) attrs["data-cell"] = "editing";
        else {
          attrs["data-cell"] = result.error ? "error" : "total";
          attrs["data-total"] = result.display;
          attrs.title = result.error ? result.error.reason : `${cellAddress(r, k)} ${result.formula}`;
        }
      } else if (result.numeric && !(title && r === 0)) {
        attrs["data-cell"] = "number";
      }
      if (cellPos === here) attrs["data-here"] = "";
      if (Object.keys(attrs).length) out.push(Decoration.node(cellPos, cellPos + cell.nodeSize, attrs));
      cellPos += cell.nodeSize;
    });
    rowPos += row.nodeSize;
  });
}

/** Every table's cell drawings; `here` is the position before the cell holding the cursor. */
export function decorate(doc: PMNode, here: number): DecorationSet {
  const out: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.spec.tableRole !== "table") return true;
    decorateTable(node, pos, here, out);
    return true; // a table inside a cell gets its own totals
  });
  return DecorationSet.create(doc, out);
}

export const TableTotals = Extension.create({
  name: "tableTotals",
  addProseMirrorPlugins() {
    return [
      new Plugin<TotalsState>({
        key,
        state: {
          init: (_, state) => {
            const here = cellHere(state);
            return { here, set: decorate(state.doc, here) };
          },
          apply: (tr, old, _, state) => {
            const here = cellHere(state);
            if (!tr.docChanged && here === old.here) return old;
            return { here, set: decorate(state.doc, here) };
          },
        },
        props: {
          decorations: (state) => key.getState(state)?.set ?? DecorationSet.empty,
        },
      }),
    ];
  },
});
