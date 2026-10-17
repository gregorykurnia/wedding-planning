"use client";

import { useContext, type ReactNode } from "react";
import { SaveScopeContext, useSaveScopeState } from "@/lib/data/use-autosave-field";
import { SHEET_FAILED } from "@/lib/model/save-state";
import styles from "./fields.module.css";

/**
 * One save scope: a detail screen, or (`sheet`) a sheet that edits an existing
 * record. Every `useAutosaveField` under it reports here, and its `SaveLine`
 * sums them up. `demo` overrides the session's demonstration mode, for the gallery.
 */
export function SaveScopeProvider({
  demo,
  sheet = false,
  children,
}: {
  demo?: boolean;
  sheet?: boolean;
  children: ReactNode;
}) {
  const scope = useSaveScopeState(demo, sheet);
  return <SaveScopeContext.Provider value={scope}>{children}</SaveScopeContext.Provider>;
}

/**
 * The save-state line (guide §4.9): "Every change saves as you go", then
 * "Saving", then "Saved"; "1 change not saved" in rose when a change fails. On
 * a screen it sits centred under the title. In a sheet scope a failure reads
 * "Couldn’t save. What you typed is kept. Try again", and Try again retries
 * every change that didn't save. `held` replaces the line while a change waits
 * for something to be fixed ("1 change not saved yet: the end time").
 */
export function SaveLine({ held }: { held?: string | null }) {
  const scope = useContext(SaveScopeContext);
  if (!scope) return null;
  const { line, retryAll, sheet } = scope;
  // A change that can't be saved until something is fixed (guide §6.1, N9): the screen says what.
  if (held) {
    return (
      <p className={`${styles.saveLine} ${styles.saveFailed}`} role="status">
        {held}
      </p>
    );
  }
  const failed = line.kind === "failed";
  return (
    <p className={failed ? `${styles.saveLine} ${styles.saveFailed}` : styles.saveLine} role="status">
      {failed && sheet ? (
        <>
          {SHEET_FAILED}{" "}
          <button type="button" className={`${styles.link} ${styles.rose}`} onClick={retryAll}>
            Try again
          </button>
        </>
      ) : (
        line.text
      )}
    </p>
  );
}
