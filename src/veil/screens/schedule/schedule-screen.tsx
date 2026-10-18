"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { isIsoDate } from "@/lib/model/dates";
import { dues } from "@/lib/model/money";
import { reminderCantArrive } from "@/lib/model/schedule";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { AgendaGroup } from "@/veil/parts/agenda/agenda-group";
import { FocusChips } from "@/veil/parts/chips/focus-chips";
import { Context, CountFigure, Hero, Kicker } from "@/veil/parts/hero/hero";
import { Message } from "@/veil/parts/message/message";
import { useRecordPayment } from "@/veil/parts/payment/use-record-payment";
import { FilterCheck } from "@/veil/parts/tools/filters";
import { ShowMore } from "@/veil/parts/tools/results";
import { SearchField } from "@/veil/parts/tools/search-field";
import { Toolbar, Toggles } from "@/veil/parts/tools/toolbar";
import { veilHref } from "@/veil/href";
import { AddButton } from "@/veil/shell/add-button";
import { Banner } from "@/veil/shell/banner";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { SubNav } from "@/veil/shell/sub-nav";
import { AddEventSheet } from "./add-event-sheet";
import { EventSheet } from "./event-sheet";
import styles from "./schedule-screen.module.css";
import { NOTHING_SCHEDULED, SCHEDULE_SUB, noResults, reminderBoxText } from "./schedule-text";

/** Things shown at a time (guide §5.19). */
const PAGE = 80;

/**
 * The Schedule, agenda view (guide §5.19; S1–S3, S5–S7, S10, O2): what is late or
 * due today, then everything with a date in one line of time: our own events,
 * payments due on bookings and tasks with a due date. An event opens its sheet;
 * a payment or a task is a read-only reflection that links to where it lives.
 */
export function ScheduleScreen() {
  const read = useSchedule();
  return (
    <PageColumn width="wide">
      <ScreenState read={read} what="your schedule" onRetry={() => window.location.reload()}>
        {(data) => <Agenda data={data} />}
      </ScreenState>
    </PageColumn>
  );
}

function Agenda({ data }: { data: ScheduleData | null }) {
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
  const router = useRouter();
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
    router.replace(pathname);
  }, [eventParam, newParam, dateParam, data, sheets, router, pathname]);

  const all = useMemo(
    () => (data ? agendaItems(data.events, dues(data.bookings, today), data.tasks) : []),
    [data, today],
  );
  const summary = lateOrToday(all, today);
  const filter = { kind, query, showDone };
  const items = filterAgenda(all, filter);
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

  const hero = (
    <Hero title="Schedule" sub={SCHEDULE_SUB} nav={<SubNav set="schedule" current="/schedule" />}>
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

      {items.length === 0 ? (
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
            <AgendaGroup
              key={group.key}
              group={group}
              today={today}
              onOpen={(item) => openEvent(item.id)}
              onRecordPayment={(payment) => {
                const booking = data?.bookings.find((b) => b.id === payment.id);
                if (booking) recordPayment(booking, payment.partId);
              }}
              relatedOf={relatedOf}
              funderNameOf={(item) => (item.funder ? (data?.funderNames.get(item.funder) ?? null) : null)}
              reminderLineOf={(item) => item.type === "event" && cantArriveIds.has(item.id) && !isLate(item, today)}
            />
          ))}
          <ShowMore more={more} onMore={() => setShown((count) => count + PAGE)} />
        </>
      )}

      <AddButton onPress={() => openAdd()}>Add to the schedule</AddButton>
    </>
  );
}
