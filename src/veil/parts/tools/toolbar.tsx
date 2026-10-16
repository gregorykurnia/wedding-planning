import type { ReactNode } from "react";
import styles from "./tools.module.css";

/** Guide §4.12. The row that holds the search and the order, and the first row of filters under it. */
export function Toolbar({ continued = false, children }: { continued?: boolean; children: ReactNode }) {
  return <div className={[styles.tools, continued && styles.continued].filter(Boolean).join(" ")}>{children}</div>;
}

/** The toggles beside the search: "Only ones we're keen on" and the order. */
export function Toggles({ children }: { children: ReactNode }) {
  return <div className={styles.toggles}>{children}</div>;
}

/** The row of filters: selects, ranges, checks and "Show everything". */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className={styles.filters}>{children}</div>;
}
