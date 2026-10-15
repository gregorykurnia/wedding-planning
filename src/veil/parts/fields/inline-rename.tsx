"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FIELD_FAILED } from "@/lib/model/save-state";
import styles from "./fields.module.css";

type InlineRenameProps = {
  /** The name as it is now. */
  name: string;
  /** Names the input for screen readers, such as "Funder's name". */
  label: string;
  /** Writes the new name. A rejection keeps the input open, as typed. */
  onSave: (name: string) => Promise<unknown>;
  /** The rename is over: it saved, was cancelled, or had nothing to change. */
  onClose: () => void;
};

/**
 * Inline rename (guide §4.9): the name becomes an input with a rose underline.
 * Enter saves, Escape cancels, and "Save name · Cancel" does the same with a
 * press. An empty name, or the same name, is a cancel: the old one stays. If
 * the write fails the input stays as typed, with the usual line and Try again.
 */
export function InlineRename({ name, label, onSave, onClose }: InlineRenameProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(name);
  const [state, setState] = useState<"typing" | "saving" | "failed">("typing");
  const alive = useRef(true);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
    alive.current = true;
    const live = alive;
    return () => {
      live.current = false;
    };
  }, []);

  const save = () => {
    const next = text.trim();
    if (!next || next === name) {
      onClose();
      return;
    }
    setState("saving");
    onSave(next).then(
      () => {
        if (alive.current) onClose();
      },
      () => {
        if (alive.current) setState("failed");
      },
    );
  };

  const busy = state === "saving";

  return (
    <div className={styles.rename}>
      <label className="sr" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        ref={input}
        dir="auto"
        className={styles.renameInput}
        value={text}
        maxLength={60}
        readOnly={busy}
        aria-invalid={state === "failed" || undefined}
        onChange={(event) => {
          setText(event.target.value);
          if (state === "failed") setState("typing");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (!busy) save();
          }
          if (event.key === "Escape") {
            // A sheet or menu behind this must not close as well.
            event.stopPropagation();
            if (!busy) onClose();
          }
        }}
      />
      <span className={styles.renameActions}>
        <button type="button" className={styles.link} disabled={busy} onClick={save}>
          {busy ? "Saving" : "Save name"}
        </button>
        <button type="button" className={styles.link} disabled={busy} onClick={onClose}>
          Cancel
        </button>
      </span>
      {state === "failed" ? (
        <p className={`${styles.err} ${styles.renameErr}`} role="alert">
          <span>{FIELD_FAILED}</span>
          <button type="button" className={`${styles.link} ${styles.rose}`} onClick={save}>
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}
