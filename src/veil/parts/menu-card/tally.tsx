import { n0 } from "@/lib/model/format";
import styles from "./tally.module.css";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export interface TallyRow {
  label: string;
  count: number;
  /**
   * `of-which` is an indented, smaller sub-line of the row above ("if space
   * allows"). `apart` is a count kept out of the total, so it's muted.
   */
  tone?: "plain" | "of-which" | "apart";
}

/**
 * Headcounts (guide §4.8): a label, a dotted leader and a serif number. A sub-line
 * and a count kept apart are both muted, as the prototype draws them.
 */
export function Tally({ rows }: { rows: TallyRow[] }) {
  return (
    <ul className={styles.tally}>
      {rows.map((row) => {
        const tone = row.tone ?? "plain";
        return (
          <li key={row.label} className={join(tone !== "plain" && styles.apart, tone === "of-which" && styles.ofWhich)}>
            {row.label}
            <span className={styles.lead} aria-hidden="true" />
            {tone === "of-which" ? (
              <span className="num">{n0(row.count)}</span>
            ) : (
              <span className={`${styles.count} num`}>{n0(row.count)}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
