"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useOnline } from "@/lib/data/session";
import { offlineOr } from "@/lib/model/save-state";
import { newFunderId } from "@/lib/data/funders";
import { TextLink } from "@/veil/parts/actions/text-link";
import { ADD_FAILED, ADD_PLACEHOLDER, DEMO_ADDING } from "./funder-text";
import styles from "./who-pays.module.css";

type AddFunderRowProps = {
  /** Demonstration mode: the row opens, but Add funder is off and says why. */
  demo: boolean;
  /** Writes the funder. `id` is made once for this row, so Try again rewrites the same funder and never adds two. */
  onAdd: (id: string, name: string) => Promise<unknown>;
  /** The row is over: it added, was cancelled, or was empty. */
  onClose: () => void;
};

/**
 * The new funder's row (guide §5.9, `?state=adding`): an input with "For
 * example, Tante Lily", then Add funder and Cancel. Enter adds, Escape cancels.
 * A form that creates saves on a press, so a failure keeps what was typed and
 * the button becomes Try again (guide §6.1).
 */
export function AddFunderRow({ demo, onAdd, onClose }: AddFunderRowProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const funderId = useRef<string | null>(null);
  const [text, setText] = useState("");
  const offline = !useOnline();
  const [state, setState] = useState<"typing" | "saving" | "failed">("typing");

  useEffect(() => {
    input.current?.focus();
    alive.current = true;
    const live = alive;
    return () => {
      live.current = false;
    };
  }, []);

  const busy = state === "saving";

  const add = () => {
    if (demo || busy) return;
    const name = text.trim();
    if (!name) {
      onClose();
      return;
    }
    setState("saving");
    let attempt: Promise<unknown>;
    try {
      funderId.current ??= newFunderId();
      attempt = onAdd(funderId.current, name);
    } catch (error) {
      attempt = Promise.reject(error);
    }
    attempt.then(
      () => {
        if (alive.current) onClose();
      },
      () => {
        if (alive.current) setState("failed");
      },
    );
  };

  return (
    <li className={`${styles.funder} ${styles.adding}`}>
      <span className={styles.who}>
        <label className="sr" htmlFor={id}>
          New funder’s name
        </label>
        <input
          id={id}
          ref={input}
          dir="auto"
          className={styles.addInput}
          placeholder={ADD_PLACEHOLDER}
          maxLength={60}
          value={text}
          readOnly={busy}
          aria-invalid={state === "failed" || undefined}
          onChange={(event) => {
            setText(event.target.value);
            if (state === "failed") setState("typing");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
            if (event.key === "Escape") {
              // A sheet or menu behind this must not close as well.
              event.stopPropagation();
              if (!busy) onClose();
            }
          }}
        />
      </span>
      <div className={styles.acts}>
        <TextLink disabled={demo} busy={busy} busyLabel="Adding" tone={state === "failed" ? "rose" : "ink"} onClick={add}>
          {state === "failed" ? "Try again" : "Add funder"}
        </TextLink>
        <TextLink disabled={busy} onClick={onClose}>
          Cancel
        </TextLink>
      </div>
      {demo && <p className={styles.line}>{DEMO_ADDING}</p>}
      {state === "failed" && (
        <p className={`${styles.line} ${styles.failed}`} role="alert">
          {offlineOr(ADD_FAILED, offline)}
        </p>
      )}
    </li>
  );
}
