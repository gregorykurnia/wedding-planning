"use client";

import Link from "next/link";
import { isLate, type AgendaItem } from "@/lib/model/agenda";
import type { IsoDate } from "@/lib/model/bookings";
import { useFlash } from "@/veil/shell/flash";
import { isCallLink, lateFlag, recordHref, rowKind, rowSub, rowWhen } from "./agenda-text";
import styles from "./agenda.module.css";

export interface AgendaRowProps {
  item: AgendaItem;
  /** Today as `YYYY-MM-DD`; late is worked out against it, never stored. */
  today: IsoDate;
  /** An event's title opens its sheet. */
  onOpen?: (item: AgendaItem) => void;
  /** Record payment, on a payment. */
  onRecordPayment?: (item: AgendaItem) => void;
  /** The vendor or venue an event is about, found by the screen. */
  related?: { name: string; href: string } | null;
  /** Who pays a payment: the funder's name, or `null` when nobody is named yet. */
  funderName?: string | null;
  /** A reminder set for a time of day, which can't arrive any more (N11): the row says so. */
  reminderLine?: boolean;
}

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/** The flash target of a row: a payment flashes with its booking and part. */
const flashTarget = (item: AgendaItem) =>
  item.type === "payment"
    ? { kind: "booking", id: item.id, ...(item.partId ? { partId: item.partId } : {}) }
    : { kind: item.type, id: item.id };

/**
 * One line of the agenda (guide §4.25): when, what kind, the title, a line
 * under it and, on the right, a late flag or Record payment. Events open
 * their sheet; a payment or a task is a read-only reflection that links to
 * its booking or task.
 */
export function AgendaRow({ item, today, onOpen, onRecordPayment, related, funderName, reminderLine }: AgendaRowProps) {
  const flash = useFlash(flashTarget(item));
  const late = isLate(item, today);
  const when = rowWhen(item, today);
  const sub = rowSub(item, funderName);
  const href = recordHref(item);
  const flag = lateFlag(item, today);
  // Colour by kind: our own events of the kind Payment are gold too.
  const kindClass = item.kind === "payment" ? styles.payment : item.kind === "task" ? styles.task : "";

  return (
    <li
      className={join(styles.ag, kindClass, late && styles.late, item.status !== "scheduled" && styles[item.status], flash)}
      data-agenda-key={item.key}
    >
      <span className={styles.when}>
        <b>{when.main}</b>
        {when.small ? <small>{when.small}</small> : null}
      </span>
      <div className={styles.body}>
        <span className={styles.kind}>{rowKind(item)}</span>
        {href ? (
          <Link className={styles.what} href={href} dir="auto">
            {item.title}
          </Link>
        ) : (
          <button type="button" className={styles.what} dir="auto" onClick={() => onOpen?.(item)}>
            {item.title}
          </button>
        )}
        {sub || isCallLink(item.where) ? (
          <span className={styles.sub} dir="auto">
            {isCallLink(item.where) && item.type === "event" ? (
              <a className={styles.link} href={item.where.trim()} target="_blank" rel="noopener noreferrer">
                Join the call
              </a>
            ) : (
              sub
            )}
          </span>
        ) : null}
        {item.type === "event" && related ? (
          <Link className={styles.rel} href={related.href} dir="auto">
            {related.name}
          </Link>
        ) : null}
        {item.type === "event" && reminderLine && !late ? (
          <span className={styles.remBad}>Its reminder can’t arrive. Choose another</span>
        ) : null}
      </div>
      {flag || item.type === "payment" ? (
        <div className={styles.aside}>
          {flag ? <span className={styles.flag}>{flag}</span> : null}
          {item.type === "payment" ? (
            <button
              type="button"
              className={join(styles.btn, !late && styles.quiet)}
              onClick={() => onRecordPayment?.(item)}
            >
              Record payment
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
