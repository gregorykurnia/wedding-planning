"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSchedule, type ScheduleData } from "@/lib/data/schedule";
import { useToday } from "@/lib/data/use-today";
import {
  AGENDA_FILTERS,
  agendaGroups,
  agendaItems,
  filterAgenda,
  isFilteringAgenda,
  isLate,
  lateOrToday,
  pageGroups,
  type AgendaFilterKey,
  type AgendaItem,
} from "@/lib/model/agenda";
import type { IsoDate } from "@/lib/model/bookings";
import { isIsoDate } from "@/lib/model/dates";
import { dues } from "@/lib/model/money";
import { reminderCantArrive } from "@/lib/model/schedule";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { AgendaGroup, type AgendaRowHandlers } from "@/veil/parts/agenda/agenda-group";
import { FocusChips } from "@/veil/parts/chips/focus-chips";
import { Context, CountFigure, Hero, Kicker } from "@/veil/parts/hero/hero";
import { Message } from "@/veil/parts/message/message";
import { useRecordPayment } from "@/veil/parts/payment/use-record-payment";
import { FilterCheck } from "@/veil/parts/tools/filters";
import { ShowMore } from "@/veil/parts/tools/results";
import { SearchField } from "@/veil/parts/tools/search-field";
import { Toolbar, Toggles } from "@/veil/parts/tools/toolbar";
import { replaceAddress, veilHref } from "@/veil/href";
import { AddButton } from "@/veil/shell/add-button";
import { Banner } from "@/veil/shell/banner";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { SubNav } from "@/veil/shell/sub-nav";
import { AddEventSheet } from "./add-event-sheet";
import { EventSheet } from "./event-sheet";
import { MonthView } from "./month-view";
import styles from "./schedule-screen.module.css";
import { NOTHING_SCHEDULED, SCHEDULE_SUB, noResults, reminderBoxText } from "./schedule-text";

/** Things shown at a time (guide §5.19). */
const PAGE = 80;

/** The Schedule's two views, one route each: the sub-navigation's Agenda and Month. */
export type ScheduleView = "agenda" | "month";

/**
 * The Schedule (guide §5.19 agenda, §5.20 month; S1–S5, S7, S10, O2): what is late
 * or due today, then everything with a date in one line of time, or the same
 * things on a month grid with the chosen day listed under it. An event opens its
 * sheet; a payment or a task is a read-only reflection that links to where it lives.
 */
export function ScheduleScreen({ view = "agenda" }: { view?: ScheduleView }) {
  const read = useSchedule();
  return (
    <PageColumn width="wide">
      <ScreenState read={read} what="your schedule" onRetry={() => window.location.reload()}>
        {(data) => <Schedule data={data} view={view} />}
      </ScreenState>
    </PageColumn>
  );
}

function Schedule({ data, view }: { data: ScheduleData | null; view: ScheduleView }) {
  const today = useToday();
  const sheets = useSheets();
  const recordPayment = useRecordPayment();

  const [kind, setKind] = useState<AgendaFilterKey>("all");
  const [query, setQuery] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const openEvent = (id: string) => sheets.open(<EventSheet eventId={id} />);
  const openAdd = (date?: string | null) => sheets.open(<AddEventSheet date={isIsoDate(date) ? date : null} />);

  // `?event=<id>` opens that event, `?new=1` the add sheet (`&date=` picks its day); the address is cleared once handled.
  const pathname = usePathname();
  const params = useSearchParams();
  const eventParam = params.get("event");
  const newParam = params.get("new");
  const dateParam = params.get("date");
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const key = eventParam ? `event:${eventParam}` : newParam ? `new:${dateParam ?? ""}` : null;
    if (!key || handled.current === key) return;
    if (eventParam && !data) return;
    handled.current = key;
    if (eventParam) {
      if (data?.events.some((e) => e.id === eventParam)) sheets.open(<EventSheet eventId={eventParam} />);
    } else {
      sheets.open(<AddEventSheet date={isIsoDate(dateParam) ? dateParam : null} />);
    }
    replaceAddress(pathname);
  }, [eventParam, newParam, dateParam, data, sheets, pathname]);

  // The month's chosen day is `?day=` when the address names one, else today, so it follows midnight until someone picks a day.
  const dayParam = params.get("day");
  const [picked, setPicked] = useState<IsoDate | null>(() => (isIsoDate(dayParam) ? dayParam : null));
  const day = picked ?? today;
  const pickDay = (next: IsoDate) => {
    setPicked(next === today ? null : next);
    window.history.replaceState(null, "", next === today ? pathname : `${pathname}?day=${next}`);
  };

  const all = useMemo(
    () => (data ? agendaItems(data.events, dues(data.bookings, today), data.tasks) : []),
    [data, today],
  );
  const summary = lateOrToday(all, today);
  const filter = { kind, query, showDone };
  const items = filterAgenda(all, filter, (id) => data?.funderNames.get(id) ?? null);
  const groups = pageGroups(agendaGroups(items, today), shown);
  const more = Math.min(PAGE, items.length - shown);

  // Reminders set for a time of day, before the once-a-day rule, can't arrive (N11).
  const cantArrive = data ? data.events.filter((e) => reminderCantArrive(e, today)) : [];
  const cantArriveIds = new Set(cantArrive.map((e) => e.id));
  const box = cantArrive.length ? reminderBoxText(cantArrive.map((e) => e.title)) : null;

  const narrow = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setShown(PAGE);
  };
  const showEverything = () => {
    setQuery("");
    setKind("all");
    setShown(PAGE);
  };

  const relatedOf = (item: AgendaItem) => {
    const found = item.relatedId ? data?.related.get(item.relatedId) : undefined;
    if (!found || !item.relatedId) return null;
    return {
      name: found.name,
      href: veilHref(found.kind === "vendor" ? `/vendors/${item.relatedId}` : `/vendors/venues?venue=${item.relatedId}`),
    };
  };

  const rows: AgendaRowHandlers = {
    onOpen: (item) => openEvent(item.id),
    onRecordPayment: (payment) => {
      const booking = data?.bookings.find((b) => b.id === payment.id);
      if (booking) recordPayment(booking, payment.partId);
    },
    relatedOf,
    funderNameOf: (item) => (item.funder ? (data?.funderNames.get(item.funder) ?? null) : null),
    reminderLineOf: (item) => item.type === "event" && cantArriveIds.has(item.id) && !isLate(item, today),
  };

  const hero = (
    <Hero
      title="Schedule"
      sub={SCHEDULE_SUB}
      nav={<SubNav set="schedule" current={view === "month" ? "/schedule/month" : "/schedule"} />}
    >
      {summary.has && (
        <>
          <Kicker>{summary.kicker}</Kicker>
          <CountFigure count={summary.figure} tone={summary.late ? "late" : undefined} />
          <Context>
            {summary.context.map((part, index) =>
              part.emphasis ? (
                <b key={index} className={part.emphasis === "late" ? styles.late : undefined}>
                  {part.text}
                </b>
              ) : (
                part.text
              ),
            )}
          </Context>
        </>
      )}
    </Hero>
  );

  if (all.length === 0 && !data?.events.length) {
    return (
      <>
        {hero}
        <Message
          kind="nothing-yet"
          inline
          title={NOTHING_SCHEDULED.title}
          actions={<Btn onClick={() => openAdd()}>Add to the schedule</Btn>}
        >
          {NOTHING_SCHEDULED.body}
        </Message>
      </>
    );
  }

  const none = noResults(query);

  return (
    <>
      {hero}
      {box && (
        <Banner tone="rose" inline role="status">
          {box.lead}{" "}
          {box.shown.map((name, index) => {
            const event = cantArrive[index];
            return (
              <span key={event.id}>
                {index > 0 ? ", " : ""}
                <TextLink onClick={() => openEvent(event.id)}>
                  <span dir="auto">{name}</span>
                </TextLink>
              </span>
            );
          })}
          {box.rest}
          {box.tail}
        </Banner>
      )}
      <FocusChips
        label="Show"
        value={kind}
        chips={AGENDA_FILTERS.map((f) => ({ id: f.key, label: f.label }))}
        onChoose={(id) => narrow(setKind)(id as AgendaFilterKey)}
      />
      <Toolbar tight>
        <SearchField
          label="Search the schedule"
          placeholder="Search everything with a date"
          value={query}
          onChange={narrow(setQuery)}
        />
        <Toggles>
          <FilterCheck label="Show completed and cancelled" checked={showDone} onChange={narrow(setShowDone)} />
        </Toggles>
      </Toolbar>

      {view === "month" ? (
        <MonthView items={items} today={today} day={day} onDay={pickDay} onAdd={openAdd} {...rows} />
      ) : items.length === 0 ? (
        <Message
          kind="no-results"
          inline
          title={none.title}
          actions={
            isFilteringAgenda(filter) ? (
              <Btn variant="quiet" onClick={showEverything}>
                Show everything
              </Btn>
            ) : undefined
          }
        >
          {none.body}
        </Message>
      ) : (
        <>
          {groups.map((group) => (
            <AgendaGroup key={group.key} group={group} today={today} {...rows} />
          ))}
          <ShowMore more={more} onMore={() => setShown((count) => count + PAGE)} />
        </>
      )}

      <AddButton onPress={() => openAdd(view === "month" ? day : null)}>Add to the schedule</AddButton>
    </>
  );
}
