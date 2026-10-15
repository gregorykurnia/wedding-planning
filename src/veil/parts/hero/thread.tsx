import type { ReactNode } from "react";
import styles from "./thread.module.css";

type ThreadProps = {
  /** How much of the track is filled, 0 to 100: the share paid, or the committed share in what-if. */
  fill: number;
  /** Rose fill, for an overpaid booking or budget. */
  over?: boolean;
  /** A dashed run from the end of the fill to the end of the track: money still only in what-if items. */
  maybe?: boolean;
  /** The hollow dot at the end of the fill. The what-if thread has none. */
  dot?: boolean;
  /** The two labels under the track. */
  ends?: [ReactNode, ReactNode];
  /** A thin track with no dot or labels, for funders and tasks. */
  small?: boolean;
  /** The same words as the labels, since the labels are hidden from screen readers: "54% paid, 46% to go". */
  label: string;
};

/**
 * The thread (guide §4.4): a champagne track with a gold fill. It is role="img"
 * with its label in words, so a screen reader hears the share, not the shapes.
 */
export function Thread({
  fill,
  over = false,
  maybe = false,
  dot = true,
  ends,
  small = false,
  label,
}: ThreadProps) {
  const share = Math.min(100, Math.max(0, fill));
  const classes = [styles.thread, small && styles.small, over && styles.over]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} role="img" aria-label={label}>
      <span className={styles.done} style={{ width: `${share}%` }} />
      {maybe && <span className={styles.maybe} style={{ left: `${share}%`, right: 0 }} />}
      {dot && !small && <span className={styles.dot} style={{ left: `${share}%` }} />}
      {ends && !small && (
        <span className={styles.ends}>
          <span>{ends[0]}</span>
          <span>{ends[1]}</span>
        </span>
      )}
    </div>
  );
}
