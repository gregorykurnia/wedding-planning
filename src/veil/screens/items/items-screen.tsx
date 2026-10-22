"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  newItemIds,
  removeItem,
  removeItems,
  saveItem,
  setItemConfirmed,
  setItemEvent,
  setItemPerson,
  startWithCommonItems,
  addItems,
  moveItem,
  useItems,
  type Placed,
} from "@/lib/data/items";
import { useSession } from "@/lib/data/session";
import { n0 } from "@/lib/model/format";
import {
  filterItems,
  isFilteringItems,
  itemCounts,
  peopleNames,
  withEvent,
  withPerson,
  workOnNext,
  type ItemFilter,
  type ItemRecord,
} from "@/lib/model/items";
import { ITEM_EVENTS, type ItemEvent, type ItemPerson } from "@/lib/model/labels";
import { ITEM_ORDERS, orderItems, ownOrder, type ItemOrderKey } from "@/lib/model/order";
import { inOrder, moveId, withRest } from "@/lib/model/row-moves";
import { Tries } from "@/lib/model/tries";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { Chip } from "@/veil/parts/chips/chip";
import { Context, CountFigure, Hero, Kicker } from "@/veil/parts/hero/hero";
import { Thread } from "@/veil/parts/hero/thread";
import { ItemHeads } from "@/veil/parts/items/item-heads";
import { ItemList } from "@/veil/parts/items/item-list";
import type { ItemActions } from "@/veil/parts/items/item-row";
import type { ItemField } from "@/veil/parts/items/item-text";
import { PeopleMenu } from "@/veil/parts/items/people-menu";
import { WorkOnNextCard, jumpToItem } from "@/veil/parts/items/work-on-next-card";
import { Message } from "@/veil/parts/message/message";
import { FilterCheck, ShowEverything } from "@/veil/parts/tools/filters";
import { CountLine, ShowMore, SortedNote } from "@/veil/parts/tools/results";
import { SearchField } from "@/veil/parts/tools/search-field";
import { FilterSelect, OrderBy, type OrderState } from "@/veil/parts/tools/selects";
import { FilterBar, Toggles, Toolbar } from "@/veil/parts/tools/toolbar";
import { AddButton } from "@/veil/shell/add-button";
import { Banner } from "@/veil/shell/banner";
import { useConfirm } from "@/veil/shell/confirm";
import { useFlasher } from "@/veil/shell/flash";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import { AddItemsSheet } from "./add-items-sheet";
import styles from "./items-screen.module.css";
import {
  ADD_ITEMS,
  ANYONE,
  COMMON_FAILED,
  CONFIRMED_CHOICES,
  DEMO_ADDING,
  EVENTS_LABEL,
  ITEMS_SUB,
  NEXT_ONLY,
  NOTHING_TRACKED,
  NO_MATCH_BODY,
  PEOPLE_FILTER_LABEL,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  SHOW_EVERYTHING,
  START_COMMON,
  addBelowFailed,
  addedCommonToast,
  countLine,
  itemsThread,
  moveFailed,
  nextLine,
  noMatchTitle,
  removeConfirm,
  removedToast,
  startedWith,
} from "./items-text";

/** Items shown at a time (guide §6.8: 150 at a time on this screen). */
const PAGE = 150;

const OWN: OrderState<ItemOrderKey> = { key: "own", direction: "asc" };

/** A change that didn't land, and how to run it again. */
interface Failure {
  id: string;
  field: ItemField;
  retry: () => void;
}

/** One failure, or one held choice, per item and field: a row can have several at once. */
const keyOf = (id: string, field: ItemField) => `${id}:${field}`;

const without = <T,>(map: ReadonlyMap<string, T>, key: string) => {
  if (!map.has(key)) return map;
  const next = new Map(map);
  next.delete(key);
  return next;
};

/** A change to the list as a whole that didn't land: a note above it, with Try again. */
interface Notice {
  text: string;
  retry: () => void;
}

/**
 * Wedding items (guide §5.22; T1–T10): every piece of the day and who provides
 * it, in our own order. Everything saves as you go; a change that didn't save
 * keeps what was typed or chosen and offers Try again. A sort is temporary,
 * and our own order is only moved by hand, with the handle, Alt and the arrows,
 * or the row menu.
 */
export function ItemsScreen() {
  const read = useItems();
  return (
    <PageColumn width="table">
      <ScreenState read={read} what="your wedding items" onRetry={() => window.location.reload()}>
        {(data) => <Items items={data ?? []} />}
      </ScreenState>
    </PageColumn>
  );
}

function Items({ items }: { items: ItemRecord[] }) {
  const sheets = useSheets();
  const toast = useToast();
  const confirm = useConfirm();
  const flash = useFlasher();
  const { connection } = useSession();
  const demo = connection === "demo";

  const [query, setQuery] = useState("");
  const [confirmed, setConfirmed] = useState<ItemFilter["confirmed"]>("");
  const [events, setEvents] = useState<ItemEvent[]>([]);
  const [people, setPeople] = useState<ItemPerson[]>([]);
  const [nextOnly, setNextOnly] = useState(false);
  const [order, setOrder] = useState<OrderState<ItemOrderKey>>(OWN);
  const [shown, setShown] = useState(PAGE);

  // Each row field's change that didn't save, and the choices the rows keep showing meanwhile.
  const [failures, setFailures] = useState<ReadonlyMap<string, Failure>>(new Map());
  const [held, setHeld] = useState<ReadonlyMap<string, Partial<ItemRecord>>>(new Map());
  const [notices, setNotices] = useState<ReadonlyMap<string, Notice>>(new Map());
  const tries = useRef(new Tries());

  // The first time the tracker opens it fills itself in once (T10): asked when the screen opens on an
  // empty list, and not again if the list is emptied while it is open.
  const [checking, setChecking] = useState(items.length === 0 && !demo && connection === "online");
  const [started, setStarted] = useState<number | null>(null);

  // A row to bring into view (and, for a new blank one, to type in) once it is on the page.
  const [reveal, setReveal] = useState<{ id: string; type: boolean } | null>(null);

  // Moves run one after another, each from the positions the one before left, and the list shows the
  // new order meanwhile, so three quick Alt+↓ presses move a row three places (Phase 4 review S21).
  const [pending, setPending] = useState<readonly string[] | null>(null);
  const moves = useRef<{ chain: Promise<unknown>; placed: Placed[] | null; running: number; failed: boolean }>({
    chain: Promise.resolve(),
    placed: null,
    running: 0,
    failed: false,
  });
  const stored = useMemo(() => ownOrder(items), [items]);
  const own = useMemo(() => (pending ? inOrder(stored, pending) : stored), [stored, pending]);
  const latest = useRef(own);
  useEffect(() => {
    latest.current = own;
  });
  // Once the moves have landed, the next read has them: the stored order takes over again.
  useEffect(() => {
    if (moves.current.running === 0) setPending(null);
  }, [stored]);

  const filter: ItemFilter = { query, confirmed, events, people, nextOnly };
  const filtering = isFilteringItems(filter);
  const reorderable = order.key === "own" && !filtering;
  const counts = itemCounts(items);

  const matched = useMemo(() => filterItems(own, { query, confirmed, events, people, nextOnly }), [own, query, confirmed, events, people, nextOnly]);
  const view = useMemo(() => (order.key === "own" ? matched : orderItems(matched, order.key, order.direction)), [matched, order]);
  const rows = useMemo(() => {
    if (held.size === 0) return view.slice(0, shown);
    const kept = new Map<string, Partial<ItemRecord>>();
    for (const [key, keep] of held) {
      const id = key.slice(0, key.lastIndexOf(":"));
      kept.set(id, { ...kept.get(id), ...keep });
    }
    return view.slice(0, shown).map((i) => (kept.has(i.id) ? { ...i, ...kept.get(i.id) } : i));
  }, [view, shown, held]);
  const failedFields = useMemo(() => {
    const byItem = new Map<string, Set<ItemField>>();
    for (const f of failures.values()) byItem.set(f.id, (byItem.get(f.id) ?? new Set()).add(f.field));
    return byItem as ReadonlyMap<string, ReadonlySet<ItemField>>;
  }, [failures]);

  const asked = useRef(false);
  useEffect(() => {
    if (!checking || asked.current) return;
    asked.current = true;
    startWithCommonItems(true)
      .then((ids) => setStarted(ids?.length ?? null))
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, [checking]);

  // A row that was just added or jumped to scrolls into view as soon as it is drawn, once per request.
  const revealed = useRef<typeof reveal>(null);
  useEffect(() => {
    if (!reveal || revealed.current === reveal) return;
    const row = document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(reveal.id)}"]`);
    if (!row) return;
    revealed.current = reveal;
    if (reveal.type) {
      row.scrollIntoView({ block: "center" });
      row.querySelector<HTMLElement>("[data-item-name]")?.focus({ preventScroll: true });
    } else jumpToItem(reveal.id, flash);
  }, [reveal, rows, flash]);

  const narrow =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setShown(PAGE);
    };

  const clearAll = () => {
    setQuery("");
    setConfirmed("");
    setEvents([]);
    setPeople([]);
    setNextOnly(false);
    setShown(PAGE);
  };

  /**
   * Runs a write for a row. A tap's choice or typed text (`keep`) shows at once and is let go when the
   * write lands; if it doesn't, it stays shown with the row's own line and Try again. Only the field's
   * newest try lets it go: an earlier one landing leaves a later one's text held while it saves.
   */
  function attempt(item: Pick<ItemRecord, "id">, field: ItemField, write: () => Promise<unknown>, keep?: Partial<ItemRecord>) {
    // Only this field's failure and held choice are let go when it lands; another field's stay.
    const key = keyOf(item.id, field);
    const tap = tries.current.start(key);
    if (keep) setHeld((h) => new Map(h).set(key, { ...h.get(key), ...keep }));
    const run = async () => {
      try {
        await write();
        if (!tries.current.settle(key, tap)) return;
        setFailures((map) => without(map, key));
        setHeld((h) => without(h, key));
      } catch {
        if (!tries.current.newest(key, tap)) return;
        setFailures((map) => new Map(map).set(key, { id: item.id, field, retry: () => void run() }));
      }
    };
    void run();
  }

  /** Runs a write for the list as a whole; a failure is a note above it, replaced by a retry that lands. */
  function attemptList(key: string, text: string, write: () => Promise<unknown>) {
    const clear = () =>
      setNotices((map) => {
        if (!map.has(key)) return map;
        const next = new Map(map);
        next.delete(key);
        return next;
      });
    const run = async () => {
      try {
        await write();
        clear();
      } catch {
        setNotices((map) => new Map(map).set(key, { text, retry: () => void run() }));
      }
    };
    void run();
  }

  const showNew = (id: string, type: boolean, after: ItemRecord | null, count: number) => {
    setOrder(OWN);
    clearAll();
    const at = after ? latest.current.findIndex((i) => i.id === after.id) + count : latest.current.length + count - 1;
    setShown((n) => Math.max(n, at + 1));
    setReveal({ id, type });
  };

  const openAdd = (after: ItemRecord | null) =>
    sheets.open(
      <AddItemsSheet
        after={after}
        current={() => latest.current}
        onAdded={(ids) => showNew(ids[0], false, after, ids.length)}
      />,
    );

  function addBelow(item: ItemRecord) {
    const [id] = newItemIds(1);
    attemptList(`below:${item.id}`, addBelowFailed(item.item), async () => {
      await addItems([{ id, item: "", types: item.types, persons: item.persons }], item.id, latest.current);
      showNew(id, true, item, 1);
    });
  }

  function reorder(ids: string[], movedId: string) {
    const name = latest.current.find((i) => i.id === movedId)?.item ?? "";
    // The list hands in the rows on the page; the rest of the list follows them.
    const full = withRest(ids, latest.current.map((i) => i.id));
    const m = moves.current;
    setPending(full);
    attemptList(`move:${movedId}`, moveFailed(name), () => {
      m.running += 1;
      const step = m.chain.then(async () => {
        m.placed = await moveItem(m.placed ?? latest.current, full, movedId);
      });
      m.chain = step.catch(() => {
        m.failed = true;
        m.placed = null;
      });
      return step.finally(() => {
        m.running -= 1;
        if (m.running > 0) return;
        m.placed = null;
        // A move that didn't land shows the stored order again, beside its note.
        if (m.failed) setPending(null);
        m.failed = false;
      });
    });
  }

  async function remove(item: ItemRecord) {
    let undo: (() => Promise<void>) | undefined;
    const gone = await confirm({
      ...removeConfirm(item.item),
      danger: true,
      run: async () => {
        undo = (await removeItem(item.id)).undo;
      },
    });
    if (gone && undo) {
      const put = undo;
      toast.undoable(removedToast(item.item), async () => {
        await put();
        flash({ kind: "item", id: item.id });
      });
    }
  }

  function startCommon() {
    attemptList("common", COMMON_FAILED, async () => {
      const ids = await startWithCommonItems(false);
      if (ids?.length) toast.undoable(addedCommonToast(ids.length), () => removeItems(ids));
    });
  }

  const actions: ItemActions = {
    // What was typed is held here too, not only in the row, so a row that a filter, sort or page takes
    // away and brings back still shows a change that hasn't saved (Phase 4 review S23).
    onName: (item, name) => attempt(item, "name", () => saveItem(item.id, { item: name }), { item: name }),
    onVendor: (item, vendor) => attempt(item, "vendor", () => saveItem(item.id, { vendor }), { vendor }),
    onToggleEvent: (item, event) => {
      const on = !item.types.includes(event);
      attempt(item, "events", () => setItemEvent(item.id, event, on), { types: withEvent(item.types, event, on) });
    },
    onPerson: (item, person, on) =>
      attempt(item, "person", () => setItemPerson(item.id, person, on), { persons: withPerson(item.persons, person, on) }),
    onMark: (item, next) => attempt(item, "next", () => saveItem(item.id, { next }), { next }),
    onConfirmed: (item, value) => attempt(item, "confirmed", () => setItemConfirmed(item, value), { confirmed: value }),
    onMenu: (item, action) => {
      if (action === "below") addBelow(item);
      else if (action === "several") openAdd(item);
      else if (action === "remove") void remove(item);
      else {
        const next = moveId(
          latest.current.map((i) => i.id),
          item.id,
          action === "up" ? -1 : 1,
        );
        if (next) reorder(next, item.id);
      }
    },
    // Every change of the row that didn't save runs again.
    onRetry: (item) => [...failures.values()].filter((f) => f.id === item.id).forEach((f) => f.retry()),
  };

  const hero = (
    <Hero title="Wedding items" sub={ITEMS_SUB}>
      {items.length > 0 && (
        <>
          <Kicker>Confirmed</Kicker>
          <CountFigure count={counts.confirmed} of={counts.total} />
          <Context>
            {counts.next ? (
              <>
                <b>{n0(counts.next)}</b> marked to work on next
              </>
            ) : (
              nextLine(0)
            )}
          </Context>
          <Thread fill={counts.percent} ends={itemsThread(counts).ends} label={itemsThread(counts).label} />
        </>
      )}
    </Hero>
  );

  const noticeBoxes = [...notices.entries()].map(([key, notice]) => (
    <div key={key} className={styles.notice}>
      <Banner tone="rose" inline role="alert">
        {notice.text}{" "}
        <TextLink tone="rose" onClick={notice.retry}>
          Try again
        </TextLink>
      </Banner>
    </div>
  ));

  if (items.length === 0) {
    if (checking) return hero;
    return (
      <>
        {hero}
        {noticeBoxes}
        <Message
          kind="nothing-yet"
          inline
          title={NOTHING_TRACKED.title}
          actions={
            <>
              <Btn variant="quiet" disabled={demo} onClick={startCommon}>
                {START_COMMON}
              </Btn>
              <Btn onClick={() => openAdd(null)}>{ADD_ITEMS}</Btn>
            </>
          }
        >
          {NOTHING_TRACKED.body}
        </Message>
        {demo && <p className={styles.demoLine}>{DEMO_ADDING}</p>}
      </>
    );
  }

  const next = workOnNext(items);
  const orderLabel = ITEM_ORDERS.find((o) => o.key === order.key)?.label ?? "";
  const count = countLine(view.length, rows.length, items.length, filtering);

  return (
    <>
      {hero}
      {started !== null && started > 0 && (
        <div className={styles.started}>
          <Banner inline role="status">
            {startedWith(items.length)}
          </Banner>
        </div>
      )}
      {noticeBoxes}
      {!filtering && (
        <WorkOnNextCard
          shown={next.shown}
          more={next.more}
          onMissing={(item) => {
            setShown((n) => Math.max(n, view.findIndex((i) => i.id === item.id) + 1));
            setReveal({ id: item.id, type: false });
          }}
        />
      )}
      <Toolbar>
        <SearchField label={SEARCH_LABEL} placeholder={SEARCH_PLACEHOLDER} value={query} onChange={narrow(setQuery)} />
        <Toggles>
          <OrderBy choices={ITEM_ORDERS} order={order} directional={order.key !== "own"} onChange={narrow(setOrder)} />
        </Toggles>
      </Toolbar>
      <FilterBar>
        <FilterSelect
          label="Show"
          value={confirmed}
          options={CONFIRMED_CHOICES}
          onChange={(value) => narrow(setConfirmed)(value as ItemFilter["confirmed"])}
        />
        <div className={styles.chips} role="group" aria-label={EVENTS_LABEL}>
          {ITEM_EVENTS.map((event) => (
            <Chip
              key={event.value}
              pressed={events.includes(event.value)}
              onClick={() => narrow(setEvents)(events.includes(event.value) ? events.filter((e) => e !== event.value) : [...events, event.value])}
            >
              {event.label}
            </Chip>
          ))}
        </div>
        <PeopleMenu
          kind="filter"
          summary={people.length ? peopleNames(people) : ANYONE}
          groupLabel={PEOPLE_FILTER_LABEL}
          picked={people}
          onToggle={(person, on) => narrow(setPeople)(on ? [...people, person] : people.filter((p) => p !== person))}
        />
        <FilterCheck label={NEXT_ONLY} checked={nextOnly} onChange={narrow(setNextOnly)} />
        <ShowEverything filtering={filtering} label={SHOW_EVERYTHING} onClear={clearAll} />
      </FilterBar>
      {order.key !== "own" && <SortedNote label={orderLabel} onBack={() => setOrder(OWN)} />}

      {view.length === 0 ? (
        <Message
          kind="no-results"
          inline
          title={noMatchTitle(query)}
          actions={
            <Btn variant="quiet" onClick={clearAll}>
              {SHOW_EVERYTHING}
            </Btn>
          }
        >
          {NO_MATCH_BODY}
        </Message>
      ) : (
        <>
          <ItemHeads />
          {count && <CountLine>{count}</CountLine>}
          <ItemList
            items={rows}
            actions={actions}
            reorderable={reorderable}
            onReorder={reorder}
            failed={failedFields}
            demo={demo}
          />
          <ShowMore more={Math.min(PAGE, view.length - rows.length)} onMore={() => setShown((n) => n + PAGE)} />
        </>
      )}
      <AddButton onPress={() => openAdd(null)}>{ADD_ITEMS}</AddButton>
    </>
  );
}
