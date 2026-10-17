import type { IsoDate } from "@/lib/model/bookings";
import { countdown } from "@/lib/model/countdown";
import { dateLong } from "@/lib/model/dates";
import { n0 } from "@/lib/model/format";
import styles from "./days-line.module.css";

type DaysLineProps = {
  /** The wedding date, or null until it's set: then nothing is drawn. */
  wedding: IsoDate | null;
  /** Today as `YYYY-MM-DD`. */
  today: IsoDate;
};

/**
 * The closing line of the budget (guide §5.4, N7): "157 days until Saturday 20
 * March 2027", "Tomorrow is the wedding, …", "Today is the wedding day", or
 * "Married on …" once the count has ended. The number or the key word is
 * drawn in serif and gold.
 */
export function DaysLine({ wedding, today }: DaysLineProps) {
  const count = countdown(wedding, today);
  if (!wedding || !count) return null;
  const date = dateLong(wedding, today);
  return (
    <p className={styles.days}>
      {count.phase === "before" && (
        <>
          <b>{n0(count.days)}</b> days until {date}
        </>
      )}
      {count.phase === "eve" && (
        <>
          <b>Tomorrow</b> is the wedding, {date}
        </>
      )}
      {count.phase === "day" && (
        <>
          <b>Today</b> is the wedding day
        </>
      )}
      {count.phase === "after" && <>Married on {date}</>}
    </p>
  );
}
