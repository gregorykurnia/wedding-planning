"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import styles from "./sheet.module.css";

/**
 * One sheet host for the whole new UI (guide §4.14): a centred dialog on a
 * desktop, a bottom sheet on a phone. A sheet opened from inside another (a
 * confirm over an edit sheet) stacks: only the top one shows, the ones under it
 * stay mounted but hidden, so whatever was typed in them is still there when
 * the top one closes.
 */

export interface OpenSheetOptions {
  /** Runs once when the sheet closes, however it closes. */
  onClose?: () => void;
}

export interface Sheets {
  /** Opens `node` as a sheet and returns its id. Focus moves in. */
  open(node: ReactNode, options?: OpenSheetOptions): number;
  /** Closes a sheet (the top one by default). Focus returns to what opened it. */
  close(id?: number): void;
}

/** What a component inside a sheet can ask of its own sheet. */
export interface SheetControl {
  close(): void;
  /** While busy, Escape and a tap on the scrim don't close it (a write is in flight). */
  setBusy(busy: boolean): void;
  titleId: string;
}

interface Entry {
  id: number;
  node: ReactNode;
  opener: HTMLElement | null;
  onClose?: () => void;
}

const SheetsContext = createContext<Sheets | null>(null);
const SheetContext = createContext<SheetControl | null>(null);

export function useSheets(): Sheets {
  const sheets = useContext(SheetsContext);
  if (!sheets) throw new Error("useSheets needs a SheetHost above it");
  return sheets;
}

export function useSheet(): SheetControl {
  const sheet = useContext(SheetContext);
  if (!sheet) throw new Error("useSheet only works inside an open sheet");
  return sheet;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && el.getAttribute("aria-hidden") !== "true",
  );
}

export function SheetHost({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const entriesRef = useRef<Entry[]>([]);
  const busy = useRef(new Set<number>());
  const nextId = useRef(0);
  // Where focus goes once the sheet that just closed is gone.
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const commit = useCallback((next: Entry[]) => {
    entriesRef.current = next;
    setEntries(next);
  }, []);

  const close = useCallback(
    (id?: number) => {
      const all = entriesRef.current;
      const target = id === undefined ? all[all.length - 1] : all.find((e) => e.id === id);
      if (!target) return;
      const wasTop = all[all.length - 1] === target;
      busy.current.delete(target.id);
      if (wasTop) returnFocusTo.current = target.opener;
      commit(all.filter((e) => e !== target));
      target.onClose?.();
    },
    [commit],
  );

  const open = useCallback(
    (node: ReactNode, options?: OpenSheetOptions) => {
      const id = ++nextId.current;
      const active = document.activeElement;
      commit([
        ...entriesRef.current,
        { id, node, opener: active instanceof HTMLElement ? active : null, onClose: options?.onClose },
      ]);
      return id;
    },
    [commit],
  );

  // Escape and a tap on the scrim ask to close; a busy sheet refuses.
  const requestClose = useCallback(
    (id: number) => {
      if (!busy.current.has(id)) close(id);
    },
    [close],
  );

  const top = entries[entries.length - 1];

  // Escape closes the top sheet, unless something else already took the key
  // (the menu, an open picker).
  useEffect(() => {
    if (!top) return;
    const id = top.id;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      requestClose(id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [top, requestClose]);

  // The page behind doesn't scroll while a sheet is open.
  const hasSheet = entries.length > 0;
  useEffect(() => {
    if (!hasSheet) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, [hasSheet]);

  // After a sheet closes, focus goes back to what opened it. If that is gone,
  // it goes into the sheet underneath, if there is one.
  useEffect(() => {
    const target = returnFocusTo.current;
    if (!target) return;
    returnFocusTo.current = null;
    if (target.isConnected && target.getClientRects().length > 0) target.focus();
  }, [entries]);

  // Moving to another screen closes every sheet.
  const pathname = usePathname();
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    [...entriesRef.current].reverse().forEach((e) => close(e.id));
  }, [pathname, close]);

  const setBusy = useCallback((id: number, value: boolean) => {
    if (value) busy.current.add(id);
    else busy.current.delete(id);
  }, []);

  const api = useMemo<Sheets>(() => ({ open, close }), [open, close]);

  return (
    <SheetsContext.Provider value={api}>
      {children}
      {entries.map((entry) => (
        <SheetFrame
          key={entry.id}
          entry={entry}
          active={entry === top}
          close={close}
          requestClose={requestClose}
          setBusy={setBusy}
        />
      ))}
    </SheetsContext.Provider>
  );
}

function SheetFrame({
  entry,
  active,
  close,
  requestClose,
  setBusy,
}: {
  entry: Entry;
  active: boolean;
  close: (id: number) => void;
  requestClose: (id: number) => void;
  setBusy: (id: number, busy: boolean) => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const pressedScrim = useRef(false);
  const titleId = `sheet-title-${entry.id}`;

  // Focus goes in: to the field that asked for it (React's autoFocus has
  // already run), otherwise to the first control.
  useEffect(() => {
    const el = dialog.current;
    if (!active || !el || el.contains(document.activeElement)) return;
    (focusables(el)[0] ?? el).focus();
  }, [active]);

  const control = useMemo<SheetControl>(
    () => ({
      close: () => close(entry.id),
      setBusy: (value) => setBusy(entry.id, value),
      titleId,
    }),
    [close, setBusy, entry.id, titleId],
  );

  // Tab stays inside the sheet (guide §8).
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialog.current) return;
    const items = focusables(dialog.current);
    const first = items[0];
    const last = items[items.length - 1];
    const at = document.activeElement;
    if (!first || !last) {
      e.preventDefault();
      dialog.current.focus();
    } else if (e.shiftKey && (at === first || at === dialog.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Only a press that began on the scrim counts, so selecting text in a field
  // and letting go outside the sheet doesn't close it.
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    pressedScrim.current = e.target === e.currentTarget;
  }

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (pressedScrim.current && e.target === e.currentTarget) requestClose(entry.id);
    pressedScrim.current = false;
  }

  return (
    <div
      className={styles.scrim}
      hidden={!active}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <div
        ref={dialog}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <SheetContext.Provider value={control}>{entry.node}</SheetContext.Provider>
      </div>
    </div>
  );
}

/** The frame inside every sheet: a centred serif title and an optional sub line. */
export function Sheet({
  title,
  sub,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  const sheet = useContext(SheetContext);
  return (
    <>
      <h2 id={sheet?.titleId} className={styles.title} dir="auto">
        {title}
      </h2>
      {sub && (
        <p className={styles.sub} dir="auto">
          {sub}
        </p>
      )}
      {children}
    </>
  );
}

/** The centred row of actions at the foot of a sheet: quiet first, then the primary. */
export function SheetActions({ children }: { children: ReactNode }) {
  return <div className={styles.acts}>{children}</div>;
}
