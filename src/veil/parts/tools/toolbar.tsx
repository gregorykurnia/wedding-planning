import type { ReactNode } from "react";
import styles from "./tools.module.css";

/**
 * Guide §4.12. The row that holds the search and the order, and the first row of filters under it.
 * `tight` is for a toolbar that follows the focus chips, which already leave room above it;
 * `close` is the schedule's, closer still.
 */
export function Toolbar({
  continued = false,
  tight = false,
  close = false,
  children,
}: {
  continued?: boolean;
  tight?: boolean;
  close?: boolean;
  children: ReactNode;
}) {
  const classes = [styles.tools, continued && styles.continued, tight && styles.tight, close && styles.close];
  return <div className={classes.filter(Boolean).join(" ")}>{children}</div>;
}

/** The toggles beside the search: "Only ones we're keen on" and the order. */
export function Toggles({ children }: { children: ReactNode }) {
  return <div className={styles.toggles}>{children}</div>;
}

/** The row of filters: selects, ranges, checks and "Show everything". */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className={styles.filters}>{children}</div>;
}
