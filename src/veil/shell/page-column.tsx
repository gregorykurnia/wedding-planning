import type { ReactNode } from "react";
import styles from "./page-column.module.css";

type PageColumnProps = {
  /**
   * The column's measure (guide §3, Columns): `default` for the budget, detail
   * screens and settings; `wide` for long lists (bookings, vendors, documents,
   * files, schedule and tasks, guests, venues, shortlist); `doc` for the
   * editor; `table` for wedding items.
   */
  width?: "default" | "wide" | "doc" | "table";
  children: ReactNode;
};

/**
 * The page column every screen sits in, centred inside `main`. `main` itself
 * stays full width and keeps the room at the bottom for the floating add
 * button; the top bar and the demonstration banner sit above it.
 */
export function PageColumn({ width = "default", children }: PageColumnProps) {
  const className = width === "default" ? styles.column : `${styles.column} ${styles[width]}`;
  return <div className={className}>{children}</div>;
}
