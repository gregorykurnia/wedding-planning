"use client";

import { type DotKind, type MonthCell } from "@/lib/model/agenda";
import type { IsoDate } from "@/lib/model/bookings";
import { addMonths, monthHeading } from "@/lib/model/dates";
import styles from "./month.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const LEGEND: { dot: DotKind; text: string }[] = [
  { dot: "event", text: "Our events" },
  { dot: "payment", text: "Payments" },
  { dot: "task", text: "Tasks" },
  { dot: "late", text: "Late" },
];

interface MonthCalendarProps {
  year: number;
  /** 1 to 12. */
  month: number;
  /** From `monthCells`: Monday first, with the blank lead-in cells. */
  cells: readonly MonthCell[];
  today: IsoDate;
  onPick: (date: IsoDate) => void;
  onEarlier: () => void;
  onLater: () => void;
  /** Back to today: the month and the chosen day. */
  onToday: () => void;
}

/**
 * The month grid (guide §4.26): Earlier, the month's name, Later, Back to
 * today, then one button per day in reading order, Monday first. A cell's
 * label says everything its marks show, so the dots, the heart and the
 * "+2" are hidden from screen readers; the chosen day is `aria-pressed`.
 */
export function MonthCalendar({ year, month, cells, today, onPick, onEarlier, onLater, onToday }: MonthCalendarProps) {
  const heading = monthHeading(year, month, today);
  const before = addMonths(year, month, -1);
  const after = addMonths(year, month, 1);

  return (
    <div>
      <div className={styles.head}>
        <button type="button" className={styles.step} aria-label={`Earlier: ${monthHeading(before.year, before.month, today)}`} onClick={onEarlier}>
          Earlier
        </button>
        <h2 className={styles.title}>{heading}</h2>
        <button type="button" className={styles.step} aria-label={`Later: ${monthHeading(after.year, after.month, today)}`} onClick={onLater}>
          Later
        </button>
      </div>
      <p className={styles.back}>
        <button type="button" className={styles.link} onClick={onToday}>
          Back to today
        </button>
      </p>

      <div className={styles.cal} role="group" aria-label={heading}>
        {WEEKDAYS.map((name) => (
          <span key={name} className={styles.weekday} aria-hidden="true">
            {name}
          </span>
        ))}
        {cells.map((cell, index) =>
          cell.date === null ? (
            <span key={`lead-${index}`} className={`${styles.cell} ${styles.empty}`} aria-hidden="true" />
          ) : (
            <DayButton key={cell.date} cell={cell} date={cell.date} onPick={onPick} />
          ),
        )}
      </div>

      <p className={styles.legend}>
        {LEGEND.map(({ dot, text }) => (
          <span key={dot}>
            <i className={`${styles.dot} ${styles[dot]}`} aria-hidden="true" />
            {text}
          </span>
        ))}
      </p>
    </div>
  );
}

function DayButton({ cell, date, onPick }: { cell: MonthCell; date: IsoDate; onPick: (date: IsoDate) => void }) {
  const className = [
    styles.cell,
    cell.today && styles.today,
    cell.selected && styles.selected,
    cell.wedding && styles.wedding,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={className} aria-label={cell.label} aria-pressed={cell.selected} onClick={() => onPick(date)}>
      <b>{cell.day}</b>
      <span className={styles.dots} aria-hidden="true">
        {cell.dots.map((dot, index) => (
          <i key={index} className={`${styles.dot} ${styles[dot]}`} />
        ))}
        {cell.more ? <em>+{cell.more}</em> : null}
      </span>
    </button>
  );
}
