import styles from "./shimmer.module.css";

/**
 * The loading skeleton (guide §4.19): a short line for the kicker, a figure, a
 * line, a card and three rows, the shape every screen's hero takes. It is
 * hidden from screen readers; the screen says what is loading beside it.
 * `column` puts it in the page column itself, for when no screen is there yet
 * (the session check).
 */
export function Shimmer({ column = false }: { column?: boolean }) {
  return (
    <div aria-hidden="true" className={column ? styles.column : undefined}>
      <div className={`${styles.sk} ${styles.line} ${styles.short}`} />
      <div className={`${styles.sk} ${styles.fig}`} />
      <div className={`${styles.sk} ${styles.line}`} />
      <div className={`${styles.sk} ${styles.card}`} />
      <div className={`${styles.sk} ${styles.row}`} />
      <div className={`${styles.sk} ${styles.row}`} />
      <div className={`${styles.sk} ${styles.row}`} />
    </div>
  );
}
