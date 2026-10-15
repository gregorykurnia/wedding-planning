import Link from "next/link";
import { Fragment } from "react";
import { Chevron } from "@/veil/icons/chevron";
import styles from "./doors.module.css";

/** One piece of a door's summary. The summary may hold one `attention` piece, drawn rose ("1 late"). */
export interface SummaryPart {
  text: string;
  attention?: boolean;
}

export interface DoorItem {
  /** Unique within the list; the list key. */
  id: string;
  /** The serif name: "Bookings", "Payments due", "Who pays". */
  name: string;
  /** Where the door leads. The caller applies `veilHref`. */
  href: string;
  /** The muted summary, on the right. On a phone it moves under the name. */
  summary: SummaryPart[];
}

export interface DoorsProps {
  doors: DoorItem[];
  /** For the spacing above the list, which differs by screen (the overview's is 44px). */
  className?: string;
}

/**
 * The quiet doors (guide §4.6): rows that lead one step deeper. Each door is a
 * link whose name includes its summary, so a screen reader reads both.
 */
export function Doors({ doors, className }: DoorsProps) {
  return (
    <ul className={[styles.doors, className].filter(Boolean).join(" ")}>
      {doors.map((door) => (
        <li key={door.id}>
          <Door door={door} />
        </li>
      ))}
    </ul>
  );
}

/** One door: the name, the summary and a chevron, all one link. */
export function Door({ door }: { door: DoorItem }) {
  return (
    <Link href={door.href} className={styles.door}>
      <span className={styles.t}>{door.name}</span>
      <span className={styles.v}>
        {door.summary.map((part, index) => (
          <Fragment key={index}>
            {part.attention ? <span className={styles.late}>{part.text}</span> : part.text}
          </Fragment>
        ))}
      </span>
      <Chevron className={styles.chev} />
    </Link>
  );
}
