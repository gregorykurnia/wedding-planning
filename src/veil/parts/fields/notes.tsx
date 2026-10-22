"use client";

import { useId, useState } from "react";
import { linkParts } from "@/lib/model/format";
import { FIELD_FAILED, offlineOr } from "@/lib/model/save-state";
import { FieldText, Fields, FieldRow, type Bound } from "./fields";
import styles from "./fields.module.css";
import { useOnline } from "@/lib/data/session";

/** Text with its web addresses as links that open in a new tab, shown without "https://". */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {linkParts(text).map((part, index) =>
        "href" in part ? (
          <a key={index} className={styles.link} href={part.href} target="_blank" rel="noopener noreferrer">
            {part.text}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Notes as reading text (guide §4.9): line breaks kept, and web addresses
 * become links that open in a new tab, shown without "https://".
 */
export function NotesView({ text }: { text: string }) {
  return (
    <div className={styles.notesView} dir="auto">
      <LinkedText text={text} />
    </div>
  );
}

type NotesProps = Bound<string> & {
  /** Names the textarea. The heading says "Notes" already, so it isn't shown again. */
  label?: string;
  /** Under the heading when nothing is written. */
  empty?: string;
  /** Set when a failed save should show its line under the notes. */
  field?: { failed: boolean; retry: () => void; disabled: boolean };
};

/**
 * The Notes section of a detail screen (guide §4.9): a heading with Edit (or
 * Add notes), the notes as reading text, and "Nothing written yet." when empty.
 * Edit turns them into a textarea with a Done button below; the text saves on
 * blur as every field does, and Done leaves the editor. A save that failed
 * keeps its line and Try again under the reading text, so it never looks saved.
 */
export function Notes({ value, onChange, onCommit, disabled, label = "Notes", empty = "Nothing written yet.", field }: NotesProps) {
  const offline = !useOnline();
  const [editing, setEditing] = useState(false);
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h2 className={styles.notesHead} id={headingId}>
        Notes
        {editing || disabled ? null : (
          <button type="button" className={styles.link} onClick={() => setEditing(true)}>
            {value ? "Edit" : "Add notes"}
          </button>
        )}
      </h2>
      {editing ? (
        <>
          <Fields>
            <FieldRow label={label} hideLabel field={field}>
              <FieldText value={value} onChange={onChange} onCommit={onCommit} disabled={disabled} autoFocus />
            </FieldRow>
          </Fields>
          <p className={styles.notesDone}>
            <button
              type="button"
              className={styles.doneButton}
              onClick={() => {
                onCommit?.(value);
                setEditing(false);
              }}
            >
              Done
            </button>
          </p>
        </>
      ) : value ? (
        <NotesView text={value} />
      ) : (
        <p className={styles.notesEmpty}>{empty}</p>
      )}
      {!editing && field?.failed ? (
        <p className={styles.err} role="alert">
          <span>{offlineOr(FIELD_FAILED, offline)}</span>
          <button type="button" className={`${styles.link} ${styles.rose}`} onClick={field.retry}>
            Try again
          </button>
        </p>
      ) : null}
    </section>
  );
}
