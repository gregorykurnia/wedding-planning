"use client";

import type { MouseEvent, ReactNode } from "react";
import { plural, rp } from "@/lib/model/format";
import { CAPACITY_UNKNOWN, NO_ESTIMATE, NO_LOCATION, capacityText, noteOnRow } from "@/lib/model/venues";
import { LinkedText } from "@/veil/parts/fields/notes";
import { useFlash } from "@/veil/shell/flash";
import styles from "./rows.module.css";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export interface VenueRowData {
  id: string;
  name: string;
  /** The estimated cost; `null` when it was never filled in. */
  cost: number | null;
  location: string;
  /** The most guests it holds; `null` when unknown. */
  capacity: number | null;
  ruledOut?: boolean;
  fileCount: number;
  notes: string;
}

/**
 * A venue in its list (guide §4.7, §5.15): the name, the estimated cost or "No
 * estimate", the location and "Up to 300 guests", and a foot with the stage
 * thread, the file count and the note cut at 140 characters. The name opens the
 * venue's sheet: a plain tap calls `onOpen`, and the address (`href`) still
 * works for a new tab.
 */
export function VenueRow({
  venue,
  href,
  stage,
  onOpen,
}: {
  venue: VenueRowData;
  href: string;
  /** The stage thread (Task 3.9's part). */
  stage?: ReactNode;
  onOpen: () => void;
}) {
  const flash = useFlash({ kind: "venue", id: venue.id });
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onOpen();
  };

  return (
    <li className={join(venue.ruledOut && styles.ruled, flash)} data-venue-id={venue.id}>
      <div className={styles.vrow}>
        <span className={styles.first}>
          <a className={styles.vname} href={href} dir="auto" onClick={open}>
            {venue.name}
          </a>
        </span>
        {venue.cost !== null ? (
          <span className={join(styles.vprice, "num")}>{rp(venue.cost)}</span>
        ) : (
          <span className={styles.none}>{NO_ESTIMATE}</span>
        )}
        <span className={styles.meta} dir="auto">
          {venue.location || NO_LOCATION}
        </span>
        <span className={styles.right}>{venue.capacity !== null ? capacityText(venue.capacity) : CAPACITY_UNKNOWN}</span>
        <div className={styles.foot}>
          {stage}
          {venue.fileCount ? <span className={styles.meta}>{plural(venue.fileCount, "file")}</span> : null}
          {venue.notes ? (
            <span className={join(styles.meta, styles.rowNote)} dir="auto">
              <LinkedText text={noteOnRow(venue.notes)} />
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
