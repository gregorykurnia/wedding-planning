import Link from "next/link";
import type { IsoDate } from "@/lib/model/bookings";
import { dateLong } from "@/lib/model/dates";
import { rp } from "@/lib/model/format";
import { type Due, type Funder } from "@/lib/model/money";
import { Btn } from "@/veil/parts/actions/btn";
import {
  bookingHref,
  flagText,
  metaText,
  NOTHING_DUE,
  NOTHING_DUE_META,
  nextLabel,
  RECORD_PAYMENT,
  STEP_LABEL,
  stepMeta,
  stepTitle,
  titleText,
} from "./next-text";
import styles from "./next-card.module.css";

export interface NextCardProps {
  /** Today as `YYYY-MM-DD`. Late and soon are worked out against it, never stored. */
  today: IsoDate;
  /** The first dated payment still owed (`dues()[0]`), or `null` when nothing is due. */
  next: Due | null;
  /** How many dated payments are late (`dues()`), for "1 of 3 late" from two up. */
  lateCount: number;
  /** The funders, for "paid by". */
  funders: Funder[];
  /** Record payment, the card's one primary button. */
  onRecord: () => void;
  /**
   * On the booking's own page (guide §5.6): "Next step", the step as the name
   * (not a link to itself) and no category in the meta line. A booking with
   * nothing to pay has no card there, so `next` is never null.
   */
  onBooking?: boolean;
}

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/** Rose when late (the base flag), gold within 14 days, calm after that. */
const toneClass = (urgency: Due["urgency"]) =>
  urgency === "soon" ? styles.gold : urgency === "later" ? styles.calm : undefined;

/**
 * The next thing to pay (guide §4.5), ported from the prototype's `.card.next`.
 * On a phone the flag comes first, then the label, name, amount, meta and the
 * button, all in one column. The empty card keeps the same layout with no
 * amount, flag or button.
 */
export function NextCard({ today, next, lateCount, funders, onRecord, onBooking = false }: NextCardProps) {
  if (!next) {
    return (
      <section className={styles.card} aria-label="Next payment">
        <span className={styles.label}>{nextLabel(lateCount)}</span>
        <h2 className={styles.name}>{NOTHING_DUE}</h2>
        <span className={styles.meta}>{NOTHING_DUE_META}</span>
      </section>
    );
  }
  return (
    <section className={styles.card} aria-label="Next payment">
      <span className={styles.label}>{onBooking ? STEP_LABEL : nextLabel(lateCount)}</span>
      <span className={join(styles.flag, toneClass(next.urgency))}>{flagText(next, today)}</span>
      <h2 className={styles.name} dir={onBooking ? "auto" : undefined}>
        {onBooking ? (
          stepTitle(next)
        ) : (
          <Link href={bookingHref(next.booking.id)} className={styles.link}>
            {titleText(next)}
          </Link>
        )}
      </h2>
      <span className={join(styles.amt, "num")}>{rp(next.left)}</span>
      <span className={styles.meta}>{onBooking ? stepMeta(next, today, funders) : metaText(next, today, funders)}</span>
      <Btn className={styles.action} onClick={onRecord}>
        {RECORD_PAYMENT}
      </Btn>
    </section>
  );
}

export interface AfterLineProps {
  /** The payment after the next one (`dues()[1]`). */
  due: Due;
  today: IsoDate;
}

/** The line under the card (guide §4.5): "After that, Rp 18.000.000 to Kirana Florist on Sunday 11 October." */
export function AfterLine({ due, today }: AfterLineProps) {
  return (
    <p className={styles.after}>
      After that, <b>{rp(due.left)}</b> to {due.booking.name} on {dateLong(due.due, today)}.
    </p>
  );
}
