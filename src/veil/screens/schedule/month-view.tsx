"use client";

import { useState } from "react";
import { useSettings } from "@/lib/data/settings";
import { itemsOn, monthCells, type AgendaItem } from "@/lib/model/agenda";
import type { IsoDate } from "@/lib/model/bookings";
import { addMonths, dayTitle, isIsoDate } from "@/lib/model/dates";
import { TextLink } from "@/veil/parts/actions/text-link";
import { AgendaGroup, type AgendaRowHandlers } from "@/veil/parts/agenda/agenda-group";
import { MonthCalendar } from "@/veil/parts/month/month-calendar";
import styles from "./month-view.module.css";
import { ADD_SOMETHING, NOTHING_ON_DAY } from "./schedule-text";

interface MonthViewProps extends AgendaRowHandlers {
  /** What the filters let through: the marks and the chosen day's list come from these. */
  items: readonly AgendaItem[];
  today: IsoDate;
  /** The chosen day: the address's, or today. */
  day: IsoDate;
  onDay: (day: IsoDate) => void;
  /** "Add something" adds to this day. */
  onAdd: (day: IsoDate) => void;
}

const monthOf = (iso: IsoDate) => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) });

/**
 * The month (guide §5.20): the calendar with Earlier, Later and Back to today,
 * then the chosen day's agenda, or "Nothing on this day. Add something". Earlier
 * and Later move the month on screen and keep the chosen day, as the prototype
 * does; Back to today moves both.
 */
export function MonthView({ items, today, day, onDay, onAdd, ...rows }: MonthViewProps) {
  const settings = useSettings();
  const weddingDate = settings.data?.weddingDate;
  const [shown, setShown] = useState(() => monthOf(day));

  const cells = monthCells({
    ...shown,
    items,
    today,
    selected: day,
    wedding: isIsoDate(weddingDate) ? weddingDate : null,
  });
  const list = itemsOn(items, day);

  return (
    <>
      <MonthCalendar
        year={shown.year}
        month={shown.month}
        cells={cells}
        today={today}
        onPick={onDay}
        onEarlier={() => setShown((m) => addMonths(m.year, m.month, -1))}
        onLater={() => setShown((m) => addMonths(m.year, m.month, 1))}
        onToday={() => {
          setShown(monthOf(today));
          onDay(today);
        }}
      />
      <AgendaGroup
        group={{ key: day, title: dayTitle(day, today), late: false, today: day === today, count: list.length, items: list }}
        today={today}
        {...rows}
      />
      {list.length === 0 ? (
        <p className={styles.nothing}>
          {NOTHING_ON_DAY} <TextLink onClick={() => onAdd(day)}>{ADD_SOMETHING}</TextLink>
        </p>
      ) : null}
    </>
  );
}
