"use client";

import { useEffect, useRef, useState, type DragEventHandler, type KeyboardEvent } from "react";
import { choicesWith } from "@/lib/model/categories";
import { namedPeople, peopleNames, peopleText, type ItemRecord } from "@/lib/model/items";
import { ITEM_EVENTS, type ItemEvent, type ItemPerson } from "@/lib/model/labels";
import type { DropEdge } from "@/lib/model/row-moves";
import { Chevron } from "@/veil/icons/chevron";
import { SixDotHandle } from "@/veil/icons/six-dot-handle";
import { Star } from "@/veil/icons/star";
import { Tick } from "@/veil/icons/tick";
import { TextLink } from "@/veil/parts/actions/text-link";
import { useDraft } from "@/veil/parts/use-draft";
import { useFlash } from "@/veil/shell/flash";
import {
  VENDOR_PLACEHOLDER,
  handleLabel,
  itemChoiceFailed,
  itemFailed,
  menuEntries,
  whoLabel,
  type ItemField,
  type ItemMenuAction,
} from "./item-text";
import styles from "./items.module.css";
import { PeopleMenu } from "./people-menu";
import { useOnline } from "@/lib/data/session";
import { offlineOr } from "@/lib/model/save-state";

const NONE: ReadonlySet<never> = new Set();

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/** What an item row can ask its screen to do. Each is a write; leave one out and that control does nothing. */
export interface ItemActions {
  onName?: (item: ItemRecord, name: string) => void;
  onVendor?: (item: ItemRecord, vendor: string) => void;
  onCategory?: (item: ItemRecord, category: string) => void;
  onToggleEvent?: (item: ItemRecord, event: ItemEvent) => void;
  /** One person ticked (`on`) or unticked in the "who it's for" menu; "General" clears everyone (N12). */
  onPerson?: (item: ItemRecord, person: ItemPerson, on: boolean) => void;
  onMark?: (item: ItemRecord, next: boolean) => void;
  onConfirmed?: (item: ItemRecord, confirmed: boolean) => void;
  onMenu?: (item: ItemRecord, action: ItemMenuAction) => void;
  onRetry?: (item: ItemRecord) => void;
}

export interface ItemRowProps {
  item: ItemRecord;
  /** The shared categories, A to Z, then Other. */
  categories: readonly string[];
  actions: ItemActions;
  /** Our own order, with no sort or filter on: the handle shows and Move up and Move down are in the menu. */
  reorderable: boolean;
  /**
   * The controls whose last change didn't save; each is ringed. A typed field
   * keeps what was typed; a one-tap control keeps the choice, which the screen
   * goes on showing.
   */
  failedFields?: ReadonlySet<ItemField>;
  /** Demonstration mode: every control is inert. */
  demo?: boolean;
  /** A row being dragged fades to 40%. */
  dragging?: boolean;
  /** A rose line above or below, while another row is dragged over this one. */
  dropEdge?: DropEdge | null;
  /** Alt with ↑ or ↓ on the handle. */
  /** Moves among the rows shown; false when the row is at the edge of them. */
  onMoveKey?: (item: ItemRecord, by: -1 | 1) => boolean;
  dragHandlers?: {
    onDragStart: DragEventHandler<HTMLLIElement>;
    onDragEnd: DragEventHandler<HTMLLIElement>;
    onDragOver: DragEventHandler<HTMLLIElement>;
    onDragLeave: DragEventHandler<HTMLLIElement>;
    onDrop: DragEventHandler<HTMLLIElement>;
  };
}

/**
 * One wedding item (guide §4.28). A desktop row reads: handle · item name
 * (serif input) · category (a small select) · vendor · events (four small
 * chips) · who it's for (a menu of checks, N12) · star
 * (work on next) · tick (confirmed) · ⋯. Under 860px it stacks, the handle,
 * name, star, tick and ⋯ on top. Every change saves at once; a change that
 * didn't save keeps what was typed, rings the field and offers Try again.
 */
export function ItemRow({
  item,
  categories,
  actions,
  reorderable,
  failedFields = NONE,
  demo = false,
  dragging = false,
  dropEdge = null,
  onMoveKey,
  dragHandlers,
}: ItemRowProps) {
  const offline = !useOnline();
  const flash = useFlash({ kind: "item", id: item.id });
  const [name, setName] = useDraft(item.item);
  const [vendor, setVendor] = useDraft(item.vendor);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const commitName = (text: string) => {
    const next = text.trim();
    // An item can't be nameless: the old name comes back.
    if (!next) return setName(item.item);
    if (next !== item.item) actions.onName?.(item, next);
  };
  const commitVendor = (text: string) => {
    const next = text.trim();
    if (next !== item.vendor) actions.onVendor?.(item, next);
  };

  const closeMenu = (refocus: boolean) => {
    setMenuOpen(false);
    if (refocus) menuButton.current?.focus();
  };

  // Open: focus goes to the first entry; a press elsewhere or Tab closes it.
  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !menuButton.current?.contains(target)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [menuOpen]);

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = entries.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = event.key === "ArrowDown" ? (at + 1) % entries.length : (at - 1 + entries.length) % entries.length;
      entries[next]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      entries[event.key === "Home" ? 0 : entries.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setMenuOpen(false);
    }
  };

  const onHandleKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    onMoveKey?.(item, event.key === "ArrowUp" ? -1 : 1);
  };

  const failedName = failedFields.has("name");
  const failedVendor = failedFields.has("vendor");
  const anyFailed = failedFields.size > 0;
  // One line under the row; with several failures it words the first (a typed field before a choice),
  // and its Try again runs every one of them again.
  const typedFailure = failedName ? name : vendor;
  const failedLine = offlineOr(
    failedName || failedVendor ? itemFailed(typedFailure) : itemChoiceFailed(item.item),
    offline,
  );
  const ringed = (field: ItemField) => (failedFields.has(field) ? styles.ringed : undefined);

  return (
    <li
      className={join(
        styles.irow,
        item.next && styles.next,
        item.confirmed && styles.confirmed,
        anyFailed && styles.failed,
        dragging && styles.dragging,
        dropEdge === "above" && styles.dropAbove,
        dropEdge === "below" && styles.dropBelow,
        flash,
      )}
      data-item-id={item.id}
      draggable={reorderable && !demo ? true : undefined}
      {...(reorderable && !demo ? dragHandlers : {})}
    >
      {reorderable ? (
        <button
          type="button"
          className={styles.handle}
          data-handle
          aria-label={handleLabel(item.item)}
          title="Drag, or Alt and arrow keys"
          disabled={demo}
          onKeyDown={onHandleKey}
        >
          <SixDotHandle />
        </button>
      ) : (
        <span className={styles.handle} aria-hidden="true" />
      )}
      <input
        className={styles.nm}
        data-item-name
        dir="auto"
        value={name}
        disabled={demo}
        aria-label="Item"
        aria-invalid={failedName || undefined}
        onChange={(event) => setName(event.target.value)}
        onBlur={(event) => commitName(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitName(event.currentTarget.value);
        }}
      />
      <span className={join(styles.cat, ringed("category"))}>
        <select
          value={item.category}
          disabled={demo}
          aria-label={`Category for ${item.item}`}
          onChange={(event) => actions.onCategory?.(item, event.target.value)}
        >
          {choicesWith(categories, item.category).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Chevron className={styles.catChevron} />
      </span>
      <input
        className={styles.vd}
        dir="auto"
        value={vendor}
        placeholder={VENDOR_PLACEHOLDER}
        disabled={demo}
        aria-label={`Vendor for ${item.item}`}
        aria-invalid={failedVendor || undefined}
        onChange={(event) => setVendor(event.target.value)}
        onBlur={(event) => commitVendor(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitVendor(event.currentTarget.value);
        }}
      />
      <div className={join(styles.evs, ringed("events"))} role="group" aria-label={`Events for ${item.item}`}>
        {ITEM_EVENTS.map((event) => (
          <button
            key={event.value}
            type="button"
            className={styles.ev}
            aria-pressed={item.types.includes(event.value)}
            disabled={demo}
            onClick={() => actions.onToggleEvent?.(item, event.value)}
          >
            {event.label}
          </button>
        ))}
      </div>
      <PeopleMenu
        className={styles.who}
        kind="row"
        align="end"
        summary={peopleText(item.persons)}
        summaryLabel={whoLabel(item.item, peopleNames(item.persons))}
        groupLabel="Who it’s for"
        picked={item.persons}
        muted={namedPeople(item.persons).length === 0}
        ringed={failedFields.has("person")}
        disabled={demo}
        onToggle={(person, on) => actions.onPerson?.(item, person, on)}
      />
      <button
        type="button"
        className={join(styles.tog, styles.star, ringed("next"))}
        aria-pressed={item.next}
        aria-label={`Work on next: ${item.item}`}
        title="Work on next"
        disabled={demo}
        onClick={() => actions.onMark?.(item, !item.next)}
      >
        <Star />
      </button>
      <button
        type="button"
        className={join(styles.tog, styles.conf, ringed("confirmed"))}
        aria-pressed={item.confirmed}
        aria-label={`Confirmed: ${item.item}`}
        title="Confirmed"
        disabled={demo}
        onClick={() => actions.onConfirmed?.(item, !item.confirmed)}
      >
        <Tick />
      </button>
      <button
        ref={menuButton}
        type="button"
        className={styles.moreBtn}
        aria-label={`More for ${item.item}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        disabled={demo}
        onClick={() => setMenuOpen((open) => !open)}
      >
        ⋯
      </button>
      {anyFailed ? (
        <p className={styles.err} role="alert">
          <span>{failedLine}</span>
          <TextLink tone="rose" onClick={() => actions.onRetry?.(item)}>
            Try again
          </TextLink>
        </p>
      ) : null}
      {menuOpen ? (
        <div ref={menu} className={styles.rowmenu} role="menu" aria-label={`More for ${item.item}`} onKeyDown={onMenuKey}>
          {menuEntries(reorderable).map((entry) => (
            <button
              key={entry.action}
              type="button"
              role="menuitem"
              className={entry.danger ? styles.rose : undefined}
              onClick={() => {
                const step = entry.action === "up" ? -1 : entry.action === "down" ? 1 : 0;
                closeMenu(step !== 0);
                // Move up and Move down go the way Alt+↑/↓ does: focus returns to the handle and the move is announced.
                // At the edge of the rows shown, the screen moves it in the whole list (Phase 8 review).
                if (step !== 0 && onMoveKey?.(item, step)) return;
                actions.onMenu?.(item, entry.action);
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
