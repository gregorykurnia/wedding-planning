"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Sheet, SheetActions, useSheet, useSheets } from "./sheet";
import styles from "./confirm.module.css";

/**
 * Guide §4.15 and §6.2. A question sheet with Keep it and the action. The
 * action turns busy ("Removing", "Deleting") until `run` resolves, so the
 * change never lands without a sign that it is happening.
 */
export interface ConfirmOptions {
  /** A question naming the thing: "Remove Villa Samaya Ubud?" */
  title: string;
  /** What goes with it, then the undo promise or the permanence. */
  body: ReactNode;
  /** "Remove booking", "Delete task", "Delete for good". */
  action: string;
  /** The busy label, when it isn't the gerund of the first word. */
  busy?: string;
  /** Rose fill. Every action that removes uses it. */
  danger?: boolean;
  /** The write. Held until it resolves; a rejection keeps the sheet open. */
  run?: () => Promise<unknown>;
}

const GERUNDS: Record<string, string> = {
  remove: "Removing",
  delete: "Deleting",
  empty: "Emptying",
};

function busyLabel(action: string) {
  return GERUNDS[action.split(/\s+/)[0].toLowerCase()] ?? "Working";
}

/**
 * Returns `confirm(options)`: opens the sheet and resolves `true` once the
 * action has run, `false` for Keep it, Escape or a tap outside.
 */
export function useConfirm() {
  const sheets = useSheets();
  return useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // The first answer stands; closing the sheet afterwards reports false.
        sheets.open(<ConfirmSheet {...options} onAnswer={resolve} />, {
          onClose: () => resolve(false),
        });
      }),
    [sheets],
  );
}

export function ConfirmSheet({
  title,
  body,
  action,
  busy,
  danger = true,
  run,
  onAnswer,
}: ConfirmOptions & { onAnswer: (confirmed: boolean) => void }) {
  const sheet = useSheet();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const working = useRef(false);

  async function go() {
    if (working.current) return;
    working.current = true;
    setState("busy");
    sheet.setBusy(true);
    try {
      await run?.();
    } catch {
      working.current = false;
      sheet.setBusy(false);
      setState("failed");
      return;
    }
    onAnswer(true);
    sheet.close();
  }

  function keep() {
    onAnswer(false);
    sheet.close();
  }

  const isBusy = state === "busy";

  return (
    <Sheet title={title} sub={body}>
      {state === "failed" && (
        <p className={styles.error} role="alert">
          Couldn’t do that. Nothing was changed. Try again.
        </p>
      )}
      <SheetActions>
        <button type="button" className={`${styles.btn} ${styles.quiet}`} autoFocus disabled={isBusy} onClick={keep}>
          Keep it
        </button>
        <button
          type="button"
          className={`${styles.btn} ${danger ? styles.danger : ""} ${isBusy ? styles.busy : ""}`}
          aria-disabled={isBusy || undefined}
          aria-busy={isBusy || undefined}
          onClick={() => void go()}
        >
          {isBusy ? (busy ?? busyLabel(action)) : action}
        </button>
      </SheetActions>
    </Sheet>
  );
}
