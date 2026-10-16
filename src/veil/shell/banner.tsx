import type { ReactNode } from "react";
import styles from "./banner.module.css";

type BannerProps = {
  /** Gold for the planner's own notes; rose when a change didn't go through (guide §4.17). */
  tone?: "gold" | "rose";
  /** The box with a 16px radius, inside a form, rather than the pill under the top bar. */
  inline?: boolean;
  children: ReactNode;
};

/**
 * A banner: the gold pill under the top bar or the toolbar (demonstration mode,
 * a partner in the document), or a box inside a form (a booking that couldn't
 * be added).
 */
export function Banner({ tone = "gold", inline = false, children }: BannerProps) {
  const classes = [styles.banner, tone === "rose" ? styles.rose : "", inline ? styles.inline : ""]
    .filter(Boolean)
    .join(" ");
  const banner = <p className={classes}>{children}</p>;
  return inline ? banner : <div className={styles.wrap}>{banner}</div>;
}

type ProblemProps = {
  /** Rose for errors; calm (gold) for signed-out, offline and not-connected notes. */
  tone?: "rose" | "calm";
  /** `alert` for a sign-in error and `status` for a calm note, so a screen reader announces it. */
  role?: "alert" | "status";
  children: ReactNode;
};

/** A box that says what's wrong on a sign-in or setup screen (guide §4.17). */
export function Problem({ tone = "rose", role, children }: ProblemProps) {
  const className = tone === "calm" ? `${styles.problem} ${styles.calm}` : styles.problem;
  return (
    <p className={className} role={role}>
      {children}
    </p>
  );
}
