"use client";

import type { AgendaGroup as AgendaGroupData, AgendaItem } from "@/lib/model/agenda";
import type { IsoDate } from "@/lib/model/bookings";
import { plural } from "@/lib/model/format";
import { AgendaRow, type AgendaRowProps } from "./agenda-row";
import styles from "./agenda.module.css";

interface AgendaGroupProps extends Pick<AgendaRowProps, "onOpen" | "onRecordPayment"> {
  /** From `agendaGroups`, perhaps cut by `pageGroups`. */
  group: AgendaGroupData;
  today: IsoDate;
  /** The vendor or venue an event is about. */
  relatedOf?: (item: AgendaItem) => AgendaRowProps["related"];
  /** The funder's name for a payment. */
  funderNameOf?: (item: AgendaItem) => string | null;
}

/**
 * A heading and its rows: "Late" with how many things, or a day with "Today"
 * on the right (guide §4.25). The count is the whole group's, so "Show 80
 * more" doesn't change what the heading says.
 */
export function AgendaGroup({ group, today, onOpen, onRecordPayment, relatedOf, funderNameOf }: AgendaGroupProps) {
  return (
    <>
      <h2 className={group.late ? `${styles.groupHead} ${styles.groupLate}` : styles.groupHead}>
        {group.title}
        {group.today ? <small>Today</small> : group.late ? <small>{plural(group.count, "thing")}</small> : null}
      </h2>
      <ul className={styles.agenda}>
        {group.items.map((item) => (
          <AgendaRow
            key={item.key}
            item={item}
            today={today}
            onOpen={onOpen}
            onRecordPayment={onRecordPayment}
            related={relatedOf?.(item)}
            funderName={funderNameOf?.(item)}
          />
        ))}
      </ul>
    </>
  );
}
