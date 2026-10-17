import type { ReactNode } from "react";
import { figure, isLongFigure } from "@/lib/model/format";
import styles from "./hero.module.css";

type HeroProps = {
  /** Above the head and 28px clear of it: the overview's couple names (guide §5.2). */
  lead?: ReactNode;
  /** The line above the title, in muted text. */
  category?: ReactNode;
  /** The page title. Left out on a figure-only hero, such as the what-if figure state. */
  title?: ReactNode;
  /** The line under the title. */
  sub?: ReactNode;
  /** The sub-navigation, between the title and the figure, on screens that have one. */
  nav?: ReactNode;
  /** The kicker, the figure, the context and the thread, in that order. */
  children?: ReactNode;
};

/**
 * The centred hero every screen opens with (guide §3): the category line, the
 * title, the line under it, the sub-navigation, then the figure block (guide §4.4).
 * The back link sits above it, outside.
 */
export function Hero({ lead, category, title, sub, nav, children }: HeroProps) {
  const hasHead = category != null || title != null || sub != null;
  return (
    <section className={styles.hero}>
      {lead != null && <div className={hasHead ? styles.lead : undefined}>{lead}</div>}
      {hasHead && (
        <div>
          {category != null && <p className={styles.sub}>{category}</p>}
          {title != null && (
            <h1 className={styles.title} dir="auto">
              {title}
            </h1>
          )}
          {sub != null && <p className={styles.sub}>{sub}</p>}
        </div>
      )}
      {nav}
      {children != null && <div className={hasHead ? styles.afterHead : undefined}>{children}</div>}
    </section>
  );
}

/** The line above the figure, in muted text: "Still to pay", "Overpaid by", "Paid in full". */
export function Kicker({ children }: { children: ReactNode }) {
  return <p className={styles.kicker}>{children}</p>;
}

type FigureProps = {
  /** The amount, with a minus first when negative. An overpaid figure passes the amount over, positive. */
  amount: number;
  /** Late and overpaid are rose; settled ("Paid in full") is gold. */
  tone?: "late" | "over" | "settled";
  /** The smaller figure that every screen but the budget uses. */
  md?: boolean;
};

/**
 * The one big figure (guide §4.4): serif and light, never wrapped, with a small
 * muted "Rp" before the digits. Over 13 digits it shrinks (`isLongFigure`).
 */
export function Figure({ amount, tone, md = false }: FigureProps) {
  const { sign, unit, digits } = figure(amount);
  const classes = [
    styles.figure,
    "num",
    md && styles.md,
    tone && styles[tone],
    isLongFigure(amount) && styles.long,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <p className={classes}>
      {sign}
      <span className={styles.rp}>{unit}</span>
      {digits}
    </p>
  );
}

/** The sentence under the figure, with each amount in <b> (ink, weight 450). */
export function Context({ children }: { children: ReactNode }) {
  return <p className={styles.context}>{children}</p>;
}
