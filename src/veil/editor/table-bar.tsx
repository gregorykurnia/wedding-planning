"use client";

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { cellAddress, evaluateTable, isFormula } from "@/lib/model/formulas";
import { useToast } from "@/veil/shell/toasts";
import {
  addMany,
  addRowAbove,
  cellTexts,
  changeWidth,
  hasTitleRow,
  removeTable,
  sortTable,
  tableSpot,
} from "./table-ops";
import { ADD_HINT, ADD_MAX, ADD_MIN, ADD_START, FORMULA_HINT, TABLE_REMOVED, addCount } from "./table-text";
import styles from "./table-bar.module.css";

/** What the bar shows for the cell holding the cursor, or null outside a table. */
function readSpot(editor: Editor) {
  const spot = tableSpot(editor.state);
  if (!spot) return null;
  const cells = cellTexts(spot.table);
  const titleRow = hasTitleRow(spot.table);
  const text = cells[spot.row]?.[spot.col] ?? "";
  let formula: string | null = null;
  let error: string | null = null;
  if (isFormula(text)) {
    const result = evaluateTable(cells, { titleRow })[spot.row][spot.col];
    formula = result.formula;
    error = result.error?.reason ?? null;
  }
  return {
    address: cellAddress(spot.row, spot.col),
    rows: cells.length,
    cols: cells[spot.row]?.length ?? 0,
    titleRow,
    formula,
    error,
  };
}

/** A small pill button that leaves the cursor where it is. */
function Act({
  onPress,
  rose,
  pressed,
  disabled,
  title,
  children,
}: {
  onPress: () => void;
  rose?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={rose ? `${styles.act} ${styles.rose}` : styles.act}
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

/** The toolbar's height, so the bar sits right against it however tall it wraps. */
function useToolbarHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>("[data-editor-toolbar]");
    if (!bar || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(bar.offsetHeight));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  return height;
}

/**
 * The table bar (guide §4.24), shown only while the cursor is in a table: the
 * formula bar with the cell's address, then Row, Column, Add, Sort, Width,
 * Title row and Remove table. It sits under the toolbar, or above it on a phone.
 */
export function TableBar({ editor }: { editor: Editor }) {
  const id = useId();
  const toast = useToast();
  const spot = useEditorState({ editor, selector: ({ editor: e }) => readSpot(e) });
  const [many, setMany] = useState(String(ADD_START));
  const [what, setWhat] = useState<"rows" | "columns">("rows");
  const height = useToolbarHeight();

  if (!spot) return null;

  const remove = () => {
    const undo = removeTable(editor);
    if (undo) toast.undoable(TABLE_REMOVED, undo);
  };

  const addSeveral = () => {
    const n = addCount(many);
    setMany(String(n));
    addMany(editor, what, n);
  };

  return (
    <div
      className={styles.bar}
      role="toolbar"
      aria-label="Table"
      style={height ? ({ "--toolbar-height": `${height}px` } as CSSProperties) : undefined}
    >
      <div className={styles.fx}>
        <b className={styles.address} aria-label={`Cell ${spot.address}`}>
          {spot.address}
        </b>
        {spot.formula ? (
          <>
            <code className={styles.formula}>{spot.formula}</code>
            {spot.error && <span className={styles.error}>{spot.error}</span>}
          </>
        ) : (
          <span className={styles.hint}>{FORMULA_HINT}</span>
        )}
      </div>
      <span className={styles.tg}>
        <span className={styles.tl}>Row</span>
        <Act onPress={() => addRowAbove(editor)}>Above</Act>
        <Act onPress={() => editor.chain().focus().addRowAfter().run()}>Below</Act>
        <Act rose disabled={spot.rows < 2} onPress={() => editor.chain().focus().deleteRow().run()}>
          Remove
        </Act>
      </span>
      <span className={styles.tg}>
        <span className={styles.tl}>Column</span>
        <Act onPress={() => editor.chain().focus().addColumnBefore().run()}>Left</Act>
        <Act onPress={() => editor.chain().focus().addColumnAfter().run()}>Right</Act>
        <Act rose disabled={spot.cols < 2} onPress={() => editor.chain().focus().deleteColumn().run()}>
          Remove
        </Act>
      </span>
      <span className={styles.tg}>
        <label className={styles.tl} htmlFor={`${id}-many`}>
          Add
        </label>
        <input
          id={`${id}-many`}
          className={styles.count}
          type="number"
          inputMode="numeric"
          min={ADD_MIN}
          max={ADD_MAX}
          value={many}
          aria-describedby={`${id}-many-hint`}
          onChange={(e) => setMany(e.target.value)}
          onBlur={() => setMany(String(addCount(many)))}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            addSeveral();
          }}
        />
        <select
          className={styles.what}
          aria-label="Rows or columns"
          value={what}
          onChange={(e) => setWhat(e.target.value as "rows" | "columns")}
        >
          <option value="rows">rows</option>
          <option value="columns">columns</option>
        </select>
        <Act onPress={addSeveral}>Add</Act>
        <span className="sr" id={`${id}-many-hint`}>
          {ADD_HINT}
        </span>
      </span>
      <span className={styles.tg}>
        <span className={styles.tl}>Sort</span>
        <Act title="Sort by this column, A to Z or smallest first" onPress={() => sortTable(editor, "asc")}>
          Ascending
        </Act>
        <Act title="Sort by this column, Z to A or largest first" onPress={() => sortTable(editor, "desc")}>
          Descending
        </Act>
      </span>
      <span className={styles.tg}>
        <span className={styles.tl}>Width</span>
        <Act onPress={() => changeWidth(editor, "narrower")}>Narrower</Act>
        <Act onPress={() => changeWidth(editor, "wider")}>Wider</Act>
      </span>
      <span className={styles.tg}>
        <Act pressed={spot.titleRow} onPress={() => editor.chain().focus().toggleHeaderRow().run()}>
          Title row
        </Act>
        <Act rose onPress={remove}>
          Remove table
        </Act>
      </span>
    </div>
  );
}
