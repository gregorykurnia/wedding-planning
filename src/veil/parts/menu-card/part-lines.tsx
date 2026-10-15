import { moreParts, type LineTone, type PartLineList } from "./menu-text";
import styles from "./part-lines.module.css";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

const TONE: Record<LineTone, string | undefined> = { plain: undefined, late: styles.late, done: styles.done };

export interface PartLinesProps extends PartLineList {
  /** What-if money: dashed leaders and italic values, since none of it is real yet. */
  hypothetical?: boolean;
}

/**
 * The parts of a booking in a ledger row (guide §4.8): each line is a name, a
 * dotted leader and the value, rose when late or overpaid and sage when paid. The
 * leaders are decoration, so screen readers get the name and the value only.
 */
export function PartLines({ lines, more, hypothetical = false }: PartLinesProps) {
  return (
    <ul className={join(styles.parts, hypothetical && styles.hypothetical)}>
      {lines.map((line) => (
        <li key={line.key}>
          <span className={styles.pn} dir="auto">
            {line.name}
          </span>
          <span className={styles.lead} aria-hidden="true" />
          <span className={join(styles.pv, TONE[line.tone])}>{line.value}</span>
        </li>
      ))}
      {more > 0 ? <li className={styles.more}>{moreParts(more)}</li> : null}
    </ul>
  );
}
