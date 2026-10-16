import type { ReactNode } from "react";
import type { Headcounts, Sides } from "@/lib/model/guests";
import { n0 } from "@/lib/model/format";
import { Tally } from "@/veil/parts/menu-card/tally";
import { headcountRows, notCountedLine } from "./guest-text";
import styles from "./counts.module.css";

/** The two cards side by side above the guest list (one column on a phone). */
export function CountCards({ children }: { children: ReactNode }) {
  return <div className={styles.counts}>{children}</div>;
}

/**
 * Headcounts (guide §4.29, §5.23): each event's count with plus-ones, leaving out
 * anyone not attending. "If space allows" sits under the reception, and the
 * unsure count, kept out of the events, is muted.
 */
export function HeadcountsCard({ counts }: { counts: Headcounts }) {
  return (
    <section className={styles.card}>
      <h2 className={styles.title}>
        Headcounts
      </h2>
      <p className={styles.sub}>Plus-ones included; anyone not attending left out</p>
      <Tally rows={headcountRows(counts)} />
    </section>
  );
}

/**
 * Both sides (guide §4.29, G4): family and business on the groom's and the
 * bride's side, for guests invited to both events. People whose connection
 * names neither side are counted apart, in a line under the two.
 */
export function SidesCard({ sides }: { sides: Sides }) {
  const half = (title: string, family: number, business: number) => (
    <div>
      <h3 className={styles.side}>{title}</h3>
      <p className={styles.figure}>
        <b className="num">{n0(family)}</b> family
      </p>
      <p className={styles.figure}>
        <b className="num">{n0(business)}</b> business
      </p>
    </div>
  );
  return (
    <section className={styles.card}>
      <h2 className={styles.title}>
        Both sides
      </h2>
      <p className={styles.sub}>Guests invited to both events; friends count as family</p>
      <div className={styles.sides}>
        {half("Groom’s side", sides.groomFamily, sides.groomBusiness)}
        <span className={styles.rule} aria-hidden="true" />
        {half("Bride’s side", sides.brideFamily, sides.brideBusiness)}
      </div>
      {sides.notCounted ? <p className={styles.unclear}>{notCountedLine(sides.notCounted)}</p> : null}
    </section>
  );
}
