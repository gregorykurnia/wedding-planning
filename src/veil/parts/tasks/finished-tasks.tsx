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
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <details className={styles.doneWrap} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{finishedLabel(count, open)}</summary>
      {children}
    </details>
  );
}
