"use client";

import { Fragment, useState } from "react";
import type { Booking, IsoDate } from "@/lib/model/bookings";
import { rp } from "@/lib/model/format";
import type { Due, Funder } from "@/lib/model/money";
import { paging } from "@/lib/model/order";
import { Btn } from "@/veil/parts/actions/btn";
import { Context, Figure, Hero, Kicker } from "@/veil/parts/hero/hero";
import { Message } from "@/veil/parts/message/message";
import { DueRow } from "@/veil/parts/rows/due-row";
import { Ledger } from "@/veil/parts/rows/ledger";
import { CountLine, ShowMore } from "@/veil/parts/tools/results";
import { veilHref } from "@/veil/href";
import { BackLink } from "@/veil/shell/back-link";
import {
  countText,
  groupDues,
  headline,
  NOTHING_TITLE,
  nothingBody,
  PAGE,
  SEE_BOOKINGS,
  visibleGroups,
} from "./payments-text";
import styles from "./payments.module.css";

export interface PaymentsList {
  /** Today as `YYYY-MM-DD`; late is worked out against it, never stored. */
  today: IsoDate;
  /** Every dated payment still owed, earliest first (`dues()`). */
  dues: Due[];
  funders: Funder[];
  /** Whether anything is booked, for the words of the empty layout. */
  hasBookings: boolean;
}

export interface PaymentsViewProps {
  /** The payments, or null in demonstration mode, where nothing is booked. */
  list: PaymentsList | null;
  /** Record payment for a booking, or for one of its parts. */
  onRecord: (booking: Booking, partId: string | null) => void;
}

/**
 * Payments due (guide §5.8): the figure for what's late (or soon, or all), then
 * Late, the next 14 days and each month with its total, 60 payments at a time.
 * Nothing due, or demonstration mode, shows the empty layout instead.
 */
export function PaymentsView({ list, onRecord }: PaymentsViewProps) {
  const [shown, setShown] = useState(PAGE);

  if (!list || list.dues.length === 0) {
    return (
      <>
        <BackLink path="/budget" label="Budget" />
        <Hero title="Payments due" />
        <Message
          kind="nothing-yet"
          inline
          title={NOTHING_TITLE}
          actions={
            <Btn variant="quiet" href={veilHref("/budget/bookings")}>
              {SEE_BOOKINGS}
            </Btn>
          }
        >
          {nothingBody(list?.hasBookings ?? false)}
        </Message>
      </>
    );
  }

  const { today, dues, funders } = list;
  const top = headline(dues);
  const groups = visibleGroups(groupDues(dues, today), shown);
  const { more } = paging(dues.length, shown, PAGE);
  const count = countText(dues.length, Math.min(dues.length, shown));

  return (
    <>
      <BackLink path="/budget" label="Budget" />
      <h1 className="sr">Payments due</h1>
      <Hero>
        <Kicker>{top.kicker}</Kicker>
        <Figure md amount={top.amount} tone={top.late ? "late" : undefined} />
        <Context>
          {top.context.map((part, index) =>
            typeof part === "string" ? (
              <Fragment key={index}>{part}</Fragment>
            ) : (
              <b key={index} className="num">
                {rp(part.amount)}
              </b>
            ),
          )}
        </Context>
      </Hero>
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className={group.late ? `${styles.heading} ${styles.late}` : styles.heading}>
            <span>{group.heading}</span>
            <small className={`${styles.total} num`}>{rp(group.total)}</small>
          </h2>
          <Ledger label={group.heading}>
            {group.dues.map((due) => (
              <DueRow
                key={`${due.booking.id}:${due.part.id ?? "booking"}`}
                due={due}
                funders={funders}
                today={today}
                onRecordPayment={(x) => onRecord(x.booking, x.part.id ?? null)}
              />
            ))}
          </Ledger>
        </section>
      ))}
      {count && (
        <div className={styles.paging}>
          <CountLine>{count}</CountLine>
        </div>
      )}
      <ShowMore more={more} onMore={() => setShown((size) => size + PAGE)} />
    </>
  );
}
