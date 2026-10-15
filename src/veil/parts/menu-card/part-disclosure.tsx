import type { ReactNode } from "react";
import type { IsoDate, Part } from "@/lib/model/bookings";
import { rp } from "@/lib/model/format";
import { Chevron } from "@/veil/icons/chevron";
import { partStatus, type LineTone } from "./menu-text";
import styles from "./part-disclosure.module.css";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

const TONE: Record<LineTone, string | undefined> = { plain: undefined, late: styles.late, done: styles.done };

export interface PartDisclosureProps {
  part: Part;
  /** Today as `YYYY-MM-DD`; the status is worked out against it. */
  today: IsoDate;
  /** Who pays the part, by name. The screen says "Not assigned" when nobody does. */
  funder: string;
  /** Open when the screen first draws it; after that the reader opens and closes it. */
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  /** The part's fields, files and actions, shown when it opens. */
  children?: ReactNode;
}

/**
 * One part of a booking (guide §4.8): a native disclosure. The summary has the
 * name, the price, a chevron, the funder and the status ("Rp 20.000.000 due 30
 * Oct"); the body is whatever the screen puts in it. Each part is an `li`, so
 * render these inside a `ul`.
 */
export function PartDisclosure({ part, today, funder, defaultOpen = false, onToggle, children }: PartDisclosureProps) {
  const status = partStatus(part, today);
  return (
    <li className={styles.item}>
      <details
        className={styles.part}
        open={defaultOpen}
        onToggle={(event) => onToggle?.(event.currentTarget.open)}
      >
        <summary>
          <span className={styles.pn} dir="auto">
            {part.name}
          </span>
          <span className={join(styles.pa, "num")}>{rp(part.price)}</span>
          <span className={styles.chev}>
            <Chevron />
          </span>
          <span className={styles.pm} dir="auto">
            {funder}
          </span>
          <span className={join(styles.ps, TONE[status.tone])}>{status.value}</span>
        </summary>
        <div className={styles.body}>{children}</div>
      </details>
    </li>
  );
}
