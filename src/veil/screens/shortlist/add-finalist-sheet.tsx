"use client";

import { useRef, useState } from "react";
import { addFinalist } from "@/lib/data/shortlist";
import { useCategories } from "@/lib/data/vendors";
import { newId } from "@/lib/data/write";
import { categoryList } from "@/lib/model/categories";
import { FieldInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { MoneyInput } from "@/veil/parts/fields/money";
import { Banner } from "@/veil/shell/banner";
import { useFlasher } from "@/veil/shell/flash";
import { CreateSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import { NAME_MISSING, ADD_FAILED, addSheet, addedToast } from "./shortlist-text";
import { OfflineOr } from "@/veil/parts/fields/offline-or";
import { CategorySelect } from "@/veil/parts/fields/category-select";

/**
 * "Add a finalist" (guide §5.13, F21): Name, Category, First package, Its price.
 * The record's id is made on the first press and kept until it lands, so Try
 * again after a lost connection writes the same finalist and never a second.
 */
export function AddFinalistSheet({ category }: { category: string }) {
  const sheet = useSheet();
  const toast = useToast();
  const flash = useFlasher();
  const categories = useCategories();
  const list = categories.data?.list ?? categoryList([]);

  const [name, setName] = useState("");
  const [chosen, setChosen] = useState(category && list.includes(category) ? category : "Other");
  const [packageName, setPackageName] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = useRef<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  async function add() {
    if (busy) return;
    if (!name.trim()) {
      setProblem(NAME_MISSING);
      nameInput.current?.focus();
      return;
    }
    setFailed(false);
    setBusy(true);
    id.current ??= newId("shortlist");
    const finalistId = id.current;
    try {
      const { undo } = await addFinalist({ id: finalistId, name, category: chosen, packageName, price });
      toast.undoable(addedToast(name.trim()), undo);
      flash({ kind: "finalist", id: finalistId });
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    sheet.close();
  }

  return (
    <Sheet title={addSheet.title} sub={addSheet.sub}>
      <Fields>
        <FieldRow label="Name" problem={problem}>
          <FieldInput
            ref={nameInput}
            autoFocus
            placeholder={addSheet.namePlaceholder}
            value={name}
            onChange={(next) => {
              setName(next);
              setProblem(null);
            }}
          />
        </FieldRow>
        <FieldRow label="Category">
          <CategorySelect value={chosen} onChange={setChosen} categories={list} />
        </FieldRow>
        <FieldRow label="First package">
          <FieldInput placeholder={addSheet.packagePlaceholder} value={packageName} onChange={setPackageName} />
        </FieldRow>
        <FieldRow label="Its price">
          <MoneyInput value={price} onCommit={setPrice} />
        </FieldRow>
      </Fields>
      {failed && (
        <Banner tone="rose" inline>
          <OfflineOr>{ADD_FAILED}</OfflineOr>
        </Banner>
      )}
      <CreateSheetActions
        action={failed ? "Try again" : "Add finalist"}
        busy={busy}
        busyLabel="Adding"
        onAction={() => void add()}
      />
    </Sheet>
  );
}
