"use client";

import Link from "next/link";
import type { Booking, IsoDate } from "@/lib/model/bookings";
import { rp } from "@/lib/model/format";
import { totals, type Funder } from "@/lib/model/money";
import { partLineList } from "@/veil/parts/menu-card/menu-text";
import { PartLines } from "@/veil/parts/menu-card/part-lines";
import { bookingHref } from "@/veil/parts/next-card/next-text";
import { useFlash } from "@/veil/shell/flash";
import { bookingMeta, bookingStatus, NO_TEXT } from "./ledger-text";
import styles from "./rows.module.css";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export interface BookingEntryProps {
  booking: Booking;
  /** Every funder, for the names. A funder that isn't listed reads as Not assigned. */
  funders: Funder[];
  /** Today as `YYYY-MM-DD`; late is worked out against it, never stored. */
  today: IsoDate;
}

/**
 * A booking in the Bookings list (guide §4.7): the name and the price, the meta
 * line and the status on the right, and the parts with leaders under them. The
 * whole entry is a link to the booking.
 */
export function BookingEntry({ booking, funders, today }: BookingEntryProps) {
  const flash = useFlash({ kind: "booking", id: booking.id });
  const status = bookingStatus(booking, today);
  const lines = booking.parts.length > 0 ? partLineList(booking.parts, today) : null;

  return (
    <li className={flash}>
      <Link className={join(styles.entry, styles.linkRow)} href={bookingHref(booking.id)} data-booking-id={booking.id}>
        <span className={styles.entryName} dir="auto">
          {booking.name}
        </span>
        <span className={join(styles.entryPrice, "num")}>{rp(totals(booking).price)}</span>
        <span className={styles.meta} dir="auto">
          {bookingMeta(booking, funders) || NO_TEXT}
        </span>
        <span
          className={join(
            styles.status,
            status.tone === "late" && styles.statusLate,
            status.tone === "done" && styles.statusDone,
          )}
        >
          {status.text}
        </span>
        {lines ? (
          <div className={styles.partsSlot}>
            <PartLines {...lines} />
          </div>
        ) : null}
      </Link>
    </li>
  );
}
