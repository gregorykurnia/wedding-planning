"use client";

import Link from "next/link";
import type { IsoDate } from "@/lib/model/bookings";
import { rp } from "@/lib/model/format";
import type { Due, Funder } from "@/lib/model/money";
import { Btn } from "@/veil/parts/actions/btn";
import { bookingHref, RECORD_PAYMENT, titleText } from "@/veil/parts/next-card/next-text";
import { useFlash } from "@/veil/shell/flash";
import { dateCardParts, dueTail, dueWhen } from "./ledger-text";
import styles from "./rows.module.css";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export interface DueRowProps {
  due: Due;
  /** Every funder, for the names. */
  funders: Funder[];
  /** Today as `YYYY-MM-DD`; late is worked out against it, never stored. */
  today: IsoDate;
  onRecordPayment?: (due: Due) => void;
}

/**
 * A payment due (guide §4.7): a place-card date, the booking's name with its
 * part, the amount still to pay and Record payment, with the meta line under
 * them. A late due is rose, and its Record payment is filled.
 */
export function DueRow({ due, funders, today, onRecordPayment }: DueRowProps) {
  // A part flashes its own row; a booking with no parts flashes on the booking.
  const flash = useFlash({
    kind: "booking",
    id: due.booking.id,
    ...(due.part.id ? { partId: due.part.id } : {}),
  });
  const when = dueWhen(due.due, today);
  const card = dateCardParts(due.due);

  return (
    <li className={join(styles.due, when.late && styles.dueLate, flash)} data-booking-id={due.booking.id}>
      <span className={styles.dateCard} aria-hidden="true">
        <b>{card?.day}</b>
        <span>{card?.month}</span>
      </span>
      <Link className={styles.what} href={bookingHref(due.booking.id)} dir="auto">
        {titleText(due)}
      </Link>
      <span className={join(styles.amt, "num")}>{rp(due.left)}</span>
      <span className={styles.dueMeta}>
        {when.late ? <span className={styles.lateWhen}>{when.text}</span> : when.text}
        {dueTail(due, funders)}
      </span>
      <span className={styles.act}>
        <Btn small variant={when.late ? "primary" : "quiet"} onClick={() => onRecordPayment?.(due)}>
          {RECORD_PAYMENT}
        </Btn>
      </span>
    </li>
  );
}
