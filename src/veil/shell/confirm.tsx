"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
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
 * What a write that didn't land says (G14, N14). Provisional until the design
 * studio writes it: a confirm's failure has no wording in the guide yet.
 */
export const CONFIRM_FAILED = "Couldn’t do that. Nothing was changed. Try again.";

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
          {CONFIRM_FAILED}
        </p>
      )}
      <SheetActions>
        <Btn variant="quiet" autoFocus disabled={isBusy} onClick={keep}>
          Keep it
        </Btn>
        <Btn
          variant={danger ? "danger" : "primary"}
          busy={isBusy}
          busyLabel={busy ?? busyLabel(action)}
          onClick={() => void go()}
        >
          {action}
        </Btn>
      </SheetActions>
    </Sheet>
  );
}

export interface InlineConfirmProps {
  /** The question with the name in it: "Remove Florist?" */
  question: ReactNode;
  /** What goes with it: "Its 4 vendors move to Other." */
  body?: ReactNode;
  /** The rose action: "Remove category". Its busy label is the gerund of its first word. */
  action: string;
  /** The write. The action stays busy until it resolves; a rejection keeps the question open. */
  run: () => Promise<unknown>;
  /** Keep it: the row goes back to what it was. */
  onKeep: () => void;
  /** The write landed: the row goes. */
  onDone: () => void;
}

/**
 * Guide §4.15: a row inside a sheet turns into its own confirm, with the question,
 * Keep it first and the rose action. It must be shown inside a sheet, since its
 * busy state holds that sheet open.
 */
export function InlineConfirm({ question, body, action, run, onKeep, onDone }: InlineConfirmProps) {
  const sheet = useSheet();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const working = useRef(false);

  async function go() {
    if (working.current) return;
    working.current = true;
    setState("busy");
    sheet.setBusy(true);
    try {
      await run();
    } catch {
      working.current = false;
      sheet.setBusy(false);
      setState("failed");
      return;
    }
    // The row goes with onDone, so the sheet is released first.
    sheet.setBusy(false);
    onDone();
  }

  const isBusy = state === "busy";

  return (
    <div className={styles.inline}>
      <p className={styles.question}>
        {question}
        {body !== undefined && <> {body}</>}
      </p>
      {state === "failed" && (
        <p className={styles.error} role="alert">
          {CONFIRM_FAILED}
        </p>
      )}
      <div className={styles.inlineActs}>
        <TextLink autoFocus disabled={isBusy} onClick={onKeep}>
          Keep it
        </TextLink>
        <TextLink tone="rose" busy={isBusy} busyLabel={busyLabel(action)} onClick={() => void go()}>
          {action}
        </TextLink>
      </div>
    </div>
  );
}

export interface BlockedOptions {
  /** Names the thing and what comes first: "Empty Catering first". */
  title: string;
  /** What is in the way and what to do about it. */
  body: ReactNode;
}

/**
 * Guide §4.15: a folder with contents can't be deleted yet. The notice says what
 * is in the way, with OK as its one button.
 */
export function BlockedNotice({ title, body }: BlockedOptions) {
  const sheet = useSheet();
  return (
    <Sheet title={title} sub={body}>
      <SheetActions>
        <Btn autoFocus onClick={sheet.close}>
          OK
        </Btn>
      </SheetActions>
    </Sheet>
  );
}

/** Returns `blocked(options)`: opens the notice and resolves once it closes (OK, Escape or the scrim). */
export function useBlocked() {
  const sheets = useSheets();
  return useCallback(
    (options: BlockedOptions) =>
      new Promise<void>((resolve) => {
        sheets.open(<BlockedNotice {...options} />, { onClose: () => resolve() });
      }),
    [sheets],
  );
}
