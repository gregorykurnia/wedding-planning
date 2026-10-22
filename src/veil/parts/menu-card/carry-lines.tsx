import { rp } from "@/lib/model/format";
import { moreFunders } from "./menu-text";
import styles from "./carry-lines.module.css";

export interface CarryRow {
  key: string;
  /** The funder's name, or "Not assigned yet" for the extra nobody has taken on. */
  label: string;
  amount: number;
}

export interface CarryLinesProps {
  rows: CarryRow[];
  /** Funders left out of `rows`, past the eight the screen shows. */
  more?: number;
  /** The id of the heading that names the list, so it reads as "Who would pay the extra". */
  labelledBy?: string;
}

/**
 * Who would pay the extra (guide §4.8): a funder, a dashed leader and the amount
 * in italic with a plus sign. None of it is real money yet, so it's drawn as
 * what-if.
 */
export function CarryLines({ rows, more = 0, labelledBy }: CarryLinesProps) {
  return (
    <ul className={styles.carry} aria-labelledby={labelledBy}>
      {rows.map((row) => (
        <li key={row.key}>
          <span className={styles.pn} dir="auto">
            {row.label}
          </span>
          <span className={styles.lead} aria-hidden="true" />
          <span className={`${styles.pv} num`}>{`+ ${rp(row.amount)}`}</span>
        </li>
      ))}
      {more > 0 ? <li className={styles.more}>{moreFunders(more)}</li> : null}
    </ul>
  );
}
