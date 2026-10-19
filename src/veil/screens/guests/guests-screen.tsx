"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { setGuestRsvp, useGuests, type GuestBook } from "@/lib/data/guests";
import { usePartnerName } from "@/lib/data/partner";
import { useSession } from "@/lib/data/session";
import { n0 } from "@/lib/model/format";
import { NO_GUEST_FILTER, filterGuests, headcounts, isFilteringGuests, sides, type GuestFilter, type GuestRecord } from "@/lib/model/guests";
import type { GuestEvent, Rsvp } from "@/lib/model/labels";
import { GUEST_ORDERS, orderGuests, type GuestOrderKey } from "@/lib/model/order";
import { Btn } from "@/veil/parts/actions/btn";
import { Context, CountFigure, Hero, Kicker } from "@/veil/parts/hero/hero";
import { CountCards, HeadcountsCard, SidesCard } from "@/veil/parts/guests/counts";
import { GuestRow } from "@/veil/parts/guests/guest-row";
import { rsvpToast } from "@/veil/parts/guests/guest-text";
import { Message } from "@/veil/parts/message/message";
import { Ledger } from "@/veil/parts/rows/ledger";
import { ShowEverything } from "@/veil/parts/tools/filters";
import { CountLine, ShowMore } from "@/veil/parts/tools/results";
import { SearchField } from "@/veil/parts/tools/search-field";
import { FilterSelect, OrderBy, type OrderState } from "@/veil/parts/tools/selects";
import { Toggles, Toolbar } from "@/veil/parts/tools/toolbar";
import { AddButton } from "@/veil/shell/add-button";
import { useFlasher } from "@/veil/shell/flash";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import { AddGuestSheet, EditGuestSheet } from "./guest-sheet";
import styles from "./guests-screen.module.css";
import {
  ADD_A_GUEST,
  ATTENDING_KICKER,
  DEMO_ADDING,
  INVITE_FILTER_OPTIONS,
  NOTHING_YET,
  NO_MATCH_BODY,
  RSVP_FILTER_OPTIONS,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  SHOW_EVERYONE,
  countLine,
  guestsSub,
  noMatchTitle,
  rsvpConflict,
} from "./guests-text";

/** Guests shown at a time (guide §5.23: 100 at a time). */
const PAGE = 100;

const BY_NUMBER: OrderState<GuestOrderKey> = { key: "number", direction: "asc" };

const NO_BOOK: GuestBook = { guests: [], nextNumber: 1 };

/** A reply that didn't save, and how to run it again; one per guest, by id. */
interface Failure {
  retry: () => void;
}

/**
 * Guests (guide §5.23; G1–G8): who is coming to what. The figure and the two cards work themselves out
 * from the replies; a reply is one tap on the row's switch, kept (with Try again) when it doesn't save,
 * and taken back with Undo. A guest's name opens their sheet, which saves as you go; `?guest=<id>` opens
 * it from a link.
 */
export function GuestsScreen() {
  const read = useGuests();
  return (
    <PageColumn width="wide">
      <ScreenState read={read} what="your guests" onRetry={() => window.location.reload()}>
        {(data) => <Guests book={data ?? NO_BOOK} ready={read.status === "ready"} />}
      </ScreenState>
    </PageColumn>
  );
}

function Guests({ book, ready }: { book: GuestBook; ready: boolean }) {
  const { guests } = book;
  const sheets = useSheets();
  const toast = useToast();
  const flash = useFlasher();
  const { name: partnerName } = usePartnerName();
  const { connection } = useSession();
  const demo = connection === "demo";

  const [filter, setFilter] = useState<GuestFilter>(NO_GUEST_FILTER);
  const [order, setOrder] = useState<OrderState<GuestOrderKey>>(BY_NUMBER);
  const [shown, setShown] = useState(PAGE);

  // The reply a tap chose, shown until it is saved; one that didn't save stays shown with its line,
  // whatever happens on other rows, until its own Try again lands.
  const [held, setHeld] = useState<Record<string, Rsvp>>({});
  const [failures, setFailures] = useState<ReadonlyMap<string, Failure>>(new Map());
  // A guest just added, to bring into view once their row exists.
  const [reveal, setReveal] = useState<string | null>(null);

  const filtering = isFilteringGuests(filter);
  const counts = useMemo(() => headcounts(guests), [guests]);
  const both = useMemo(() => sides(guests), [guests]);
  const view = useMemo(
    () => orderGuests(filterGuests(guests, filter), order.key, order.direction),
    [guests, filter, order],
  );
  // A guest just added is always on the page, however far down they are.
  const limit = Math.max(shown, reveal ? view.findIndex((g) => g.id === reveal) + 1 : 0);
  const rows = useMemo(
    () => view.slice(0, limit).map((g) => (g.id in held ? { ...g, rsvpStatus: held[g.id] } : g)),
    [view, limit, held],
  );

  const narrow = (next: Partial<GuestFilter>) => {
    setFilter((now) => ({ ...now, ...next }));
    setShown(PAGE);
  };
  const clearAll = () => {
    setFilter(NO_GUEST_FILTER);
    setShown(PAGE);
  };

  const openGuest = (id: string) => sheets.open(<EditGuestSheet guestId={id} />);
  const openAdd = () =>
    sheets.open(
      <AddGuestSheet
        onAdded={(id) => {
          setFilter(NO_GUEST_FILTER);
          setReveal(id);
        }}
      />,
    );

  // `?guest=<id>` opens that guest's sheet; the address is cleared once handled.
  const router = useRouter();
  const pathname = usePathname();
  const guestParam = useSearchParams().get("guest");
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!guestParam || !ready || handled.current === guestParam) return;
    handled.current = guestParam;
    if (guests.some((g) => g.id === guestParam)) sheets.open(<EditGuestSheet guestId={guestParam} />);
    router.replace(pathname);
  }, [guestParam, ready, guests, sheets, router, pathname]);

  // A guest just added scrolls into view as soon as their row is drawn.
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (!reveal || scrolledTo.current === reveal) return;
    const row = document.querySelector<HTMLElement>(`[data-guest-id="${CSS.escape(reveal)}"]`);
    if (!row) return;
    scrolledTo.current = reveal;
    row.scrollIntoView({ block: "center" });
  }, [reveal, rows]);

  /** One tap on a row's switch: shown at once, saved, then Undo; if it doesn't save the choice stays with Try again. */
  function reply(guest: GuestRecord, next: Rsvp) {
    setHeld((h) => ({ ...h, [guest.id]: next }));
    const run = async () => {
      try {
        const { undo } = await setGuestRsvp(guest, next);
        // A later tap on this row may already hold another reply: that one stays until it lands.
        setHeld((h) => {
          if (h[guest.id] !== next) return h;
          const rest = { ...h };
          delete rest[guest.id];
          return rest;
        });
        setFailures((map) => {
          if (!map.has(guest.id)) return map;
          const rest = new Map(map);
          rest.delete(guest.id);
          return rest;
        });
        toast.undoable(
          rsvpToast(guest.name, next),
          async () => {
            await undo();
            flash({ kind: "guest", id: guest.id });
          },
          rsvpConflict(partnerName, guest.name),
        );
      } catch {
        setFailures((map) => new Map(map).set(guest.id, { retry: () => void run() }));
      }
    };
    void run();
  }

  const hero = (
    <Hero title="Guests" sub={guestsSub(counts.guests, counts.people)}>
      {guests.length > 0 && (
        <>
          <Kicker>{ATTENDING_KICKER}</Kicker>
          <CountFigure count={counts.attending} />
          <Context>
            people, plus-ones included. <b>{n0(counts.waiting)}</b> still to reply.
          </Context>
        </>
      )}
    </Hero>
  );

  if (guests.length === 0) {
    return (
      <>
        {hero}
        <Message
          kind="nothing-yet"
          inline
          title={NOTHING_YET.title}
          actions={<Btn onClick={openAdd}>{ADD_A_GUEST}</Btn>}
        >
          {NOTHING_YET.body}
        </Message>
        {demo && <p className={styles.demoLine}>{DEMO_ADDING}</p>}
      </>
    );
  }

  return (
    <>
      {hero}
      <CountCards>
        <HeadcountsCard counts={counts} />
        <SidesCard sides={both} />
      </CountCards>
      <Toolbar>
        <SearchField label={SEARCH_LABEL} placeholder={SEARCH_PLACEHOLDER} value={filter.query} onChange={(query) => narrow({ query })} />
        <Toggles>
          <OrderBy
            choices={GUEST_ORDERS}
            order={order}
            onChange={(next) => {
              setOrder(next);
              setShown(PAGE);
            }}
          />
        </Toggles>
      </Toolbar>
      <Toolbar continued>
        <FilterSelect label="RSVP" value={filter.rsvp} options={RSVP_FILTER_OPTIONS} onChange={(rsvp) => narrow({ rsvp: rsvp as Rsvp | "" })} />
        <FilterSelect
          label="Invited to"
          value={filter.invite}
          options={INVITE_FILTER_OPTIONS}
          onChange={(invite) => narrow({ invite: invite as GuestEvent | "" })}
        />
        <Toggles>
          <ShowEverything filtering={filtering} label={SHOW_EVERYONE} onClear={clearAll} />
        </Toggles>
      </Toolbar>

      {view.length === 0 ? (
        <Message
          kind="no-results"
          inline
          title={noMatchTitle(filter.query)}
          actions={
            <Btn variant="quiet" onClick={clearAll}>
              {SHOW_EVERYONE}
            </Btn>
          }
        >
          {NO_MATCH_BODY}
        </Message>
      ) : (
        <>
          <CountLine>{countLine(view.length, rows.length, guests.length, filtering)}</CountLine>
          <div className={styles.list}>
            <Ledger label="Guests">
              {rows.map((guest) => (
                <GuestRow
                  key={guest.id}
                  guest={guest}
                  demo={demo}
                  failed={failures.has(guest.id)}
                  onRsvp={reply}
                  onRetry={() => failures.get(guest.id)?.retry()}
                  onOpen={(g) => openGuest(g.id)}
                />
              ))}
            </Ledger>
          </div>
          <ShowMore more={Math.min(PAGE, view.length - rows.length)} onMore={() => setShown((n) => n + PAGE)} />
        </>
      )}
      <AddButton onPress={openAdd}>{ADD_A_GUEST}</AddButton>
    </>
  );
}
