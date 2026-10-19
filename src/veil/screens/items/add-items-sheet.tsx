"use client";

import { useRef, useState } from "react";
import { addItems, newItemIds, removeItems, type NewItem, type Placed } from "@/lib/data/items";
import type { ItemRecord } from "@/lib/model/items";
import { FieldRow, FieldText, Fields } from "@/veil/parts/fields/fields";
import { Banner } from "@/veil/shell/banner";
import { useFlasher } from "@/veil/shell/flash";
import { CreateSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import { ADD_FAILED, ADD_ITEMS, ADD_SHEET_LINES, ADD_SHEET_PLACEHOLDER, addSheetSub, addedToast } from "./items-text";

/** The lines of the box as item names: one per line, blanks left out. */
export const namesOf = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * "Add items" (guide §5.22; T7): one item per line, in the list exactly where
 * they belong, copying the events and the people of the row above. Each item has
 * its id made once and kept until it lands, so Try again after a lost connection
 * writes the same items. `current` gives the list in our own order as it is when
 * the button is pressed, because the sheet can stay open while the partner adds
 * a row.
 */
export function AddItemsSheet({
  after,
  current,
  onAdded,
}: {
  /** The row the new ones go below, or null for the end of the list. */
  after: ItemRecord | null;
  current: () => Placed[];
  onAdded: (ids: string[], after: ItemRecord | null) => void;
}) {
  const sheet = useSheet();
  const toast = useToast();
  const flash = useFlasher();

  const [lines, setLines] = useState("");
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);
  const ids = useRef<string[]>([]);

  async function add() {
    if (adding) return;
    const names = namesOf(lines);
    if (names.length === 0) {
      sheet.focusFirstField();
      return;
    }
    // Each line keeps its id between tries, whatever is added to or taken from the lines.
    ids.current = names.map((_, index) => ids.current[index] ?? newItemIds(1)[0]);
    const made = ids.current;
    const rows: NewItem[] = names.map((item, index) => ({
      id: made[index],
      item,
      types: after?.types ?? [],
      persons: after?.persons ?? [],
    }));
    setFailed(false);
    setAdding(true);
    try {
      await addItems(rows, after?.id ?? null, current());
    } catch {
      setAdding(false);
      setFailed(true);
      return;
    }
    toast.undoable(addedToast(rows.length), () => removeItems(made));
    flash(made.map((id) => ({ kind: "item", id })));
    onAdded(made, after);
    sheet.close();
  }

  return (
    <Sheet title={ADD_ITEMS} sub={addSheetSub(after ? after.item : null)}>
      <Fields>
        <FieldRow label={ADD_SHEET_LINES} hideLabel>
          <FieldText value={lines} onChange={setLines} placeholder={ADD_SHEET_PLACEHOLDER} autoFocus rows={6} />
        </FieldRow>
      </Fields>
      {failed && (
        <Banner tone="rose" inline role="alert">
          {ADD_FAILED}
        </Banner>
      )}
      <CreateSheetActions action={failed ? "Try again" : "Add"} busy={adding} busyLabel="Adding" onAction={() => void add()} />
    </Sheet>
  );
}
