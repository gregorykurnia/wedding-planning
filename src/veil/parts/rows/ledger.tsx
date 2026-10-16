import type { ReactNode } from "react";
import styles from "./rows.module.css";

/**
 * A list of ledger rows: hairlines between the rows and above the first one
 * (guide §4.7). The rows are `li` elements, so they go straight inside it.
 */
export function Ledger({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul className={styles.ledger} aria-label={label}>
      {children}
    </ul>
  );
}
