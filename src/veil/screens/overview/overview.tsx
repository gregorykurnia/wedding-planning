"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { saveWeddingDate } from "@/lib/data/settings";
import { useOverview, type OverviewData } from "@/lib/data/use-overview";
import { useToday } from "@/lib/data/use-today";
import type { AgendaItem } from "@/lib/model/agenda";
import type { IsoDate } from "@/lib/model/bookings";
import { isIsoDate } from "@/lib/model/dates";
import {
  NOTHING_DATED,
  NO_DATE,
  comingFor,
  comingTitle,
  countdown,
  dateSaved,
  heroWords,
  overviewDoors,
  timeThread,
  type Countdown,
} from "@/lib/model/overview";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { AgendaRow } from "@/veil/parts/agenda/agenda-row";
import { Doors } from "@/veil/parts/doors/doors";
import { DateInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { Context, Hero, Kicker } from "@/veil/parts/hero/hero";
import { Thread } from "@/veil/parts/hero/thread";
import { InstallCard } from "@/veil/parts/device/install-card";
import { veilHref } from "@/veil/href";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useToast } from "@/veil/shell/toasts";
import styles from "./overview.module.css";
import { useInstallSuggestion } from "./use-install-suggestion";

/**
 * The overview (guide §5.2; O1–O6): the couple's names, the days to go and
 * how much of the time has gone, the next five dated things, and a pulse check
 * on budget, tasks, guests and wedding items, each a door into its detail.
 * Without a wedding date it asks for one, once.
 */
export function Overview() {
  const read = useOverview();
  return (
    <PageColumn>
      <ScreenState read={read} what="your overview" onRetry={() => window.location.reload()}>
        {(data) => <Home data={data} demo={read.status === "demo"} />}
      </ScreenState>
    </PageColumn>
  );
}

function Home({ data, demo }: { data: OverviewData | null; demo: boolean }) {
  const today = useToday();
  const settings = data?.settings;
  const yourName = settings?.yourName.trim() ?? "";
  const partnerName = settings?.partnerName.trim() ?? "";
  const names =
    yourName && partnerName ? (
      <p className={styles.names} dir="auto">
        {yourName} &amp; {partnerName}
      </p>
    ) : null;
  const wedding = isIsoDate(settings?.weddingDate) ? settings.weddingDate : null;
  const count = countdown(wedding, today);

  return (
    <>
      {count && wedding ? (
        <WeddingHero names={names} count={count} wedding={wedding} startedOn={settings?.startedOn} today={today} />
      ) : (
        <NoDate names={names} demo={demo} today={today} />
      )}
      {data && <Installable />}
      <ComingUp data={data} count={count} today={today} />
      <div className={styles.doors}>
        <Doors
          doors={overviewDoors({
            bookings: data?.bookings ?? [],
            tasks: data?.tasks ?? [],
            guests: data?.guests ?? [],
            items: data?.items ?? [],
          }).map((d) => ({ id: d.id, name: d.name, href: veilHref(d.path), summary: [{ text: d.summary }] }))}
        />
      </div>
    </>
  );
}

/** The days figure, or the day itself, and the thread of time gone (O1, N7). */
function WeddingHero({
  names,
  count,
  wedding,
  startedOn,
  today,
}: {
  names: ReactNode;
  count: Countdown;
  wedding: IsoDate;
  startedOn: string | null | undefined;
  today: IsoDate;
}) {
  const words = heroWords(count, wedding, today);
  const thread = timeThread(count, startedOn, wedding, today);
  return (
    <Hero lead={names}>
      {words.kicker && (
        <div className={styles.kicker}>
          <Kicker>{words.kicker}</Kicker>
        </div>
      )}
      {words.figure && <p className={`${styles.days} num`}>{words.figure}</p>}
      {count.phase === "after" ? (
        <p className={styles.married}>{words.context}</p>
      ) : (
        <Context>{words.context}</Context>
      )}
      {thread && <Thread fill={thread.fill} ends={[thread.start, thread.end]} label={thread.label} />}
    </Hero>
  );
}

/** No wedding date yet: ask for it once, and every countdown and due date works from it (O5). */
function NoDate({ names, demo, today }: { names: ReactNode; demo: boolean; today: IsoDate }) {
  const toast = useToast();
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const form = useRef<HTMLDivElement>(null);

  async function save() {
    if (!isIsoDate(date)) {
      form.current?.querySelector("input")?.focus();
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await saveWeddingDate(date);
      toast.confirmation(dateSaved(date, today));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Hero lead={names} title={NO_DATE.title} sub={NO_DATE.sub}>
      <div className={styles.dateForm} ref={form}>
        <Fields>
          <FieldRow label={NO_DATE.label} field={{ failed, retry: () => void save(), disabled: demo }}>
            <DateInput value={date} onChange={setDate} />
          </FieldRow>
        </Fields>
      </div>
      <p className={styles.save}>
        <Btn busy={busy} busyLabel={NO_DATE.saving} disabled={demo} onClick={() => void save()}>
          {NO_DATE.save}
        </Btn>
      </p>
      {demo && <p className={styles.demoLine}>{NO_DATE.demo}</p>}
    </Hero>
  );
}

/** Add the planner to the home screen, on a phone, until dismissed once (the logic is Task 6.4's to finish). */
function Installable() {
  const { show, dismiss } = useInstallSuggestion();
  if (!show) return null;
  return (
    <div className={styles.install}>
      <InstallCard howHref={`${veilHref("/settings")}#install`} onNotNow={dismiss} />
    </div>
  );
}

/** The next five dated things of any kind (O2). */
function ComingUp({ data, count, today }: { data: OverviewData | null; count: Countdown | null; today: IsoDate }) {
  const router = useRouter();
  const items = data ? comingFor(data.events, data.bookings, data.tasks, today) : [];
  const relatedOf = (item: AgendaItem) => {
    const found = item.relatedId ? data?.related.get(item.relatedId) : undefined;
    if (!found || !item.relatedId) return null;
    return {
      name: found.name,
      href: veilHref(found.kind === "vendor" ? `/vendors/${item.relatedId}` : `/vendors/venues?venue=${item.relatedId}`),
    };
  };

  return (
    <section className={styles.coming}>
      <h2 className={styles.comingTitle}>{comingTitle(count)}</h2>
      {items.length ? (
        <>
          <ul className={styles.agenda}>
            {items.map((item) => (
              <AgendaRow
                key={item.key}
                item={item}
                today={today}
                related={relatedOf(item)}
                funderName={item.funder ? (data?.funderNames.get(item.funder) ?? null) : null}
                onOpen={(event) => router.push(`${veilHref("/schedule")}?event=${event.id}`)}
              />
            ))}
          </ul>
          <p className={styles.all}>
            <TextLink href={veilHref("/schedule")}>See the whole schedule</TextLink>
          </p>
        </>
      ) : (
        <p className={styles.nothing}>{NOTHING_DATED}</p>
      )}
    </section>
  );
}
