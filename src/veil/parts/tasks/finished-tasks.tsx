"use client";

import { useState, type ReactNode } from "react";
import { finishedLabel } from "./task-text";
import styles from "./tasks.module.css";

/**
 * The disclosure under the open tasks (guide §4.27): "Show 4 finished tasks",
 * "Hide 4 finished tasks". Put the finished rows (a `ul` of `TaskRow`) inside.
 */
export function FinishedTasks({
  count,
  defaultOpen = false,
  children,
}: {
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  // The screen's wish, unless the list was opened or closed by hand since that wish was made. When
  // the wish changes, as when the last open task is ticked (Everything done, guide §5.21), it applies
  // again at once, not only on the first draw (P5-S17).
  const [choice, setChoice] = useState<{ wish: boolean; open: boolean } | null>(null);
  const open = choice && choice.wish === defaultOpen ? choice.open : defaultOpen;
  if (count === 0) return null;
  return (
    <details
      className={styles.doneWrap}
      open={open}
      onToggle={(event) => {
        const now = event.currentTarget.open;
        if (now !== open) setChoice({ wish: defaultOpen, open: now });
      }}
    >
      <summary>{finishedLabel(count, open)}</summary>
      {children}
    </details>
  );
}
