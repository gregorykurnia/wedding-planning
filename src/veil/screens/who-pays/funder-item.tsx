"use client";

import { useEffect, useRef } from "react";
import { NOT_ASSIGNED, type FunderRow } from "@/lib/model/money";
import { veilHref } from "@/veil/href";
import { TextLink } from "@/veil/parts/actions/text-link";
import { InlineRename } from "@/veil/parts/fields/inline-rename";
import { Thread } from "@/veil/parts/hero/thread";
import { metaParts, paidShare, restText, threadLabel } from "./funder-text";
import styles from "./who-pays.module.css";

type FunderItemProps = {
  row: FunderRow;
  renaming: boolean;
  onRename: () => void;
  /** Writes the new name; a rejection keeps the input open, as typed. */
  onSaveName: (name: string) => Promise<unknown>;
  onCloseRename: () => void;
  onRemove: () => void;
};

/** The address of Bookings searched for what has no funder (guide §5.9). */
export const NOT_ASSIGNED_HREF = veilHref(`/budget/bookings?q=${encodeURIComponent(NOT_ASSIGNED)}`);

/**
 * One row of Who pays: the name, what's still to pay (serif, right), what's
 * been paid of the price, a small thread, and the row's actions. Not assigned
 * comes last, in italic, with a way to see what has no funder.
 */
export function FunderItem({ row, renaming, onRename, onSaveName, onCloseRename, onRemove }: FunderItemProps) {
  const unassigned = row.id === null;
  const meta = metaParts(row);
  const rest = restText(row);
  const acts = useRef<HTMLDivElement>(null);
  const wasRenaming = useRef(false);

  // When a rename ends, focus goes back to Rename, since the input it was in has gone.
  useEffect(() => {
    if (wasRenaming.current && !renaming) acts.current?.querySelector("button")?.focus();
    wasRenaming.current = renaming;
  }, [renaming]);

  return (
    <li className={unassigned ? `${styles.funder} ${styles.unassigned}` : styles.funder}>
      <span className={styles.who} dir="auto">
        {renaming ? (
          <InlineRename name={row.name} label="Funder name" onSave={onSaveName} onClose={onCloseRename} />
        ) : (
          row.name
        )}
      </span>
      <span className={`${styles.rest} ${rest.over ? styles.over : ""} num`}>{rest.text}</span>
      <span className={styles.meta}>
        {meta.kind === "paid" ? (
          <>
            Paid <span className="num">{meta.paid}</span> of <span className="num">{meta.price}</span>
          </>
        ) : (
          meta.text
        )}
      </span>
      <span className={`${styles.meta} ${styles.metaRight}`}>{row.left < 0 ? "" : "still to pay"}</span>
      {row.count > 0 && (
        <div className={styles.thread}>
          <Thread small fill={paidShare(row)} over={row.left < 0} label={threadLabel(row)} />
        </div>
      )}
      {!renaming && (
        <div className={styles.acts} ref={acts}>
          {unassigned ? (
            row.count > 0 && <TextLink href={NOT_ASSIGNED_HREF}>See what has no funder</TextLink>
          ) : (
            <>
              <TextLink onClick={onRename}>Rename</TextLink>
              <TextLink tone="rose" onClick={onRemove}>
                Remove
              </TextLink>
            </>
          )}
        </div>
      )}
    </li>
  );
}
