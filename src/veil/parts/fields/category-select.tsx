"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { addCategory } from "@/lib/data/categories";
import { useOnline } from "@/lib/data/session";
import { newId } from "@/lib/data/write";
import { WriteError } from "@/lib/data/write-error";
import { choicesWith, validateCategoryName } from "@/lib/model/categories";
import { offlineOr } from "@/lib/model/save-state";
import { TextLink } from "@/veil/parts/actions/text-link";
import { FieldSelect, type Bound } from "./fields";
import styles from "./fields.module.css";

/** The last choice in a category select; it can't be a category, since a name has no control characters. */
const NEW = "\u0000new";
export const NEW_CATEGORY_CHOICE = "New category…";
const NEW_CATEGORY_LABEL = "Name of the new category";
const ADD_FAILED = "Couldn’t add the category. What you typed is kept.";

/**
 * A category select (F14) whose last choice is "New category…": it opens a
 * field under the select, and Add (or Enter) adds the category to the shared
 * list and picks it. Escape or Cancel goes back to the category that was
 * chosen. The id is made once, so Try again never adds it twice.
 */
export function CategorySelect({
  value,
  onChange,
  onCommit,
  disabled,
  categories,
}: Bound<string> & {
  /** The shared list, A to Z, then Other. */
  categories: readonly string[];
}) {
  const offline = !useOnline();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useRef<string | null>(null);
  const inputId = useId();

  const pick = (name: string) => {
    onChange?.(name);
    onCommit?.(name);
  };

  const close = () => {
    setOpen(false);
    setText("");
    setProblem(null);
  };

  async function add() {
    if (busy) return;
    const unusable = validateCategoryName(text, categories);
    if (unusable) return setProblem(unusable);
    setBusy(true);
    id.current ??= newId("vendorCategories");
    try {
      const name = await addCategory(id.current, text);
      id.current = null;
      close();
      pick(name);
    } catch (error) {
      setProblem(error instanceof WriteError && error.code === "failed" ? error.message : offlineOr(ADD_FAILED, offline));
    } finally {
      setBusy(false);
    }
  }

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      // Not the sheet's own form: Enter here adds the category.
      event.preventDefault();
      void add();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  return (
    <>
      <FieldSelect
        value={open ? NEW : value}
        disabled={disabled}
        onChange={(next) => (next === NEW ? setOpen(true) : (close(), pick(next)))}
        options={[...choicesWith(categories, value).map((c) => ({ value: c, label: c })), { value: NEW, label: NEW_CATEGORY_CHOICE }]}
      />
      {open && (
        <span className={styles.newCategory}>
          {/* A plain input: the row's own field (the select) holds the label, and Enter here adds rather than saves. */}
          <input
            id={inputId}
            dir="auto"
            className={styles.input}
            aria-label={NEW_CATEGORY_LABEL}
            aria-invalid={problem ? true : undefined}
            placeholder="Up to 40 characters"
            autoFocus
            value={text}
            disabled={busy}
            onChange={(event) => {
              setText(event.target.value);
              setProblem(null);
            }}
            onKeyDown={onKey}
          />
          <TextLink busy={busy} busyLabel="Adding" onClick={() => void add()}>
            Add
          </TextLink>
          <TextLink onClick={close}>Cancel</TextLink>
          {problem && (
            <span className={styles.newCategoryProblem} role="alert">
              {problem}
            </span>
          )}
        </span>
      )}
    </>
  );
}
