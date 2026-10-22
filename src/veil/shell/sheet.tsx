"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/data/session";
import { SaveScopeContext } from "@/lib/data/use-autosave-field";
import { TRY_AGAIN } from "@/lib/model/confirm-text";
import { SheetHolds } from "@/lib/model/sheet-holds";
import {
  CLOSED_WITHOUT,
  CLOSE_WITHOUT_ADDING,
  CLOSE_WITHOUT_IT,
  HELD_FAILED,
  SAVING_THEN_CLOSE,
  STARTED_TYPING,
  heldBlocked,
} from "@/lib/model/sheet-text";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { SaveLine } from "@/veil/parts/fields/save-scope";
import fieldStyles from "@/veil/parts/fields/fields.module.css";
import { SheetFailureContext } from "./sheet-failure";
import styles from "./sheet.module.css";
import { useOptionalToast } from "./toasts";

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

/**
 * Asked when Escape, a tap outside or Done wants to close a sheet that isn't
 * busy (N18). Returns true to go ahead; false to keep it open, having said why.
 */
export type DismissGuard = () => boolean;

/** What a component inside a sheet can ask of its own sheet. */
export interface SheetControl {
  close(): void;
  /** Closes the way Escape does: busy holds it, and the sheet's guard may keep it open (N18). */
  requestClose(): void;
  /**
   * Holds the sheet while a write is in flight: Escape and a tap on the scrim
   * don't close it until every hold is released. Returns the release.
   */
  hold(): () => void;
  /** What Escape and a tap outside ask before closing; null takes it away. */
  setGuard(guard: DismissGuard | null): void;
  /** Whether anything in the sheet was typed or changed since it opened. */
  changed(): boolean;
  /** Puts focus on the sheet's first field, to keep going. */
  focusFirstField(): void;
  titleId: string;
}

interface Entry {
  id: number;
  node: ReactNode;
  opener: HTMLElement | null;
  onClose?: () => void;
  /** The screen it was opened on; leaving that screen closes it. */
  path: string;
}

const SheetsContext = createContext<Sheets | null>(null);
/** Exported so the markup tests can render a sheet's parts without a host. */
export const SheetContext = createContext<SheetControl | null>(null);

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

/** Every typed value in a sheet, as one string: equal to the opening one means nothing was typed. */
function typedIn(root: HTMLElement): string {
  return Array.from(root.querySelectorAll<HTMLInputElement>("input, textarea, select"))
    .filter((el) => el.type !== "file" && el.type !== "hidden")
    .map((el) => (el.type === "checkbox" || el.type === "radio" ? String(el.checked) : el.value))
    .join("\u0001");
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && el.getAttribute("aria-hidden") !== "true",
  );
}

export function SheetHost({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const entriesRef = useRef<Entry[]>([]);
  const [holds] = useState(() => new SheetHolds());
  const guards = useRef(new Map<number, DismissGuard>());
  // How many failures each sheet is showing (`useSheetFailure`).
  const failures = useRef(new Map<number, number>());
  const nextId = useRef(0);
  // Where focus goes once the sheet that just closed is gone.
  const returnFocusTo = useRef<HTMLElement | null>(null);

  // The current screen, kept up to date before any page effect can open a
  // sheet: layout effects run before every passive effect of the same commit.
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useLayoutEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

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
      holds.clear(target.id);
      guards.current.delete(target.id);
      failures.current.delete(target.id);
      if (wasTop) returnFocusTo.current = target.opener;
      commit(all.filter((e) => e !== target));
      target.onClose?.();
    },
    [commit, holds],
  );

  const open = useCallback(
    (node: ReactNode, options?: OpenSheetOptions) => {
      const id = ++nextId.current;
      const active = document.activeElement;
      commit([
        ...entriesRef.current,
        {
          id,
          node,
          opener: active instanceof HTMLElement ? active : null,
          onClose: options?.onClose,
          path: pathRef.current,
        },
      ]);
      return id;
    },
    [commit],
  );

  // Escape, a tap on the scrim and Done ask to close. A busy sheet refuses; a
  // sheet with a guard may keep itself open to say a change hasn't saved (N18).
  const requestClose = useCallback(
    (id: number) => {
      if (holds.busy(id)) return;
      const guard = guards.current.get(id);
      if (guard && !guard()) return;
      close(id);
    },
    [close, holds],
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
    // The opener went with what was removed: focus the screen rather than
    // dropping it to the top of the page.
    else if (entriesRef.current.length === 0) document.getElementById("main")?.focus({ preventScroll: true });
  }, [entries]);

  // Moving to another screen closes the sheets opened on the old one, except
  // a busy one: its write is in flight and must still report back (a confirm
  // that resolved "no" here would lose the undo). It closes once its last hold
  // is released. Sheets the new screen opened as it mounted stay open.
  useEffect(() => {
    [...entriesRef.current]
      .reverse()
      .filter((e) => e.path !== pathname && !holds.busy(e.id))
      .forEach((e) => close(e.id));
  }, [pathname, close, holds]);

  const hold = useCallback(
    (id: number) => {
      const release = holds.hold(id);
      return () => {
        if (!release()) return;
        // Freed on a screen it no longer belongs to: it closes now, unless its
        // write failed. Then it stays to say so, with what was typed and Try
        // again (guide §6.5, P6-S14); the next move closes it.
        const entry = entriesRef.current.find((e) => e.id === id);
        if (entry && entry.path !== pathRef.current && !failures.current.get(id)) close(id);
      };
    },
    [holds, close],
  );

  const fail = useCallback((id: number) => {
    const count = failures.current;
    count.set(id, (count.get(id) ?? 0) + 1);
    return () => {
      const left = (count.get(id) ?? 0) - 1;
      if (left > 0) count.set(id, left);
      else count.delete(id);
    };
  }, []);

  const setGuard = useCallback((id: number, guard: DismissGuard | null) => {
    if (guard) guards.current.set(id, guard);
    else guards.current.delete(id);
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
          hold={hold}
          fail={fail}
          setGuard={setGuard}
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
  hold,
  fail,
  setGuard,
}: {
  entry: Entry;
  active: boolean;
  close: (id: number) => void;
  requestClose: (id: number) => void;
  hold: (id: number) => () => void;
  fail: (id: number) => () => void;
  setGuard: (id: number, guard: DismissGuard | null) => void;
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

  // What the fields held when the sheet opened, to tell whether anything was typed since.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (dialog.current) opened.current = typedIn(dialog.current);
  }, []);

  const control = useMemo<SheetControl>(
    () => ({
      close: () => close(entry.id),
      requestClose: () => requestClose(entry.id),
      hold: () => hold(entry.id),
      setGuard: (guard) => setGuard(entry.id, guard),
      changed: () => dialog.current !== null && opened.current !== null && typedIn(dialog.current) !== opened.current,
      focusFirstField: () => {
        const root = dialog.current;
        const field = root?.querySelector<HTMLElement>(
          "input:not([disabled]):not([type=hidden]):not([type=file]), textarea:not([disabled]), select:not([disabled])",
        );
        (field ?? (root && focusables(root)[0]))?.focus();
      },
      titleId,
    }),
    [close, requestClose, hold, setGuard, entry.id, titleId],
  );

  const failure = useCallback(() => fail(entry.id), [fail, entry.id]);

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
        <SheetContext.Provider value={control}>
          <SheetFailureContext.Provider value={failure}>{entry.node}</SheetFailureContext.Provider>
        </SheetContext.Provider>
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

/**
 * While a write runs, Escape and a tap on the scrim don't close the sheet: the
 * write has to report back (guide §6.2).
 */
function useBusy(sheet: SheetControl, busy: boolean) {
  useEffect(() => (busy ? sheet.hold() : undefined), [sheet, busy]);
}

/**
 * The foot of a sheet that creates something (guide §4.14): a quiet Cancel, then
 * the primary. In demonstration mode a line above says adding is turned off and
 * the primary is disabled; `demo` overrides the session's mode, for the gallery.
 */
export function CreateSheetActions({
  action,
  onAction,
  busy = false,
  busyLabel,
  demo,
  demoLine = "Demonstration mode: adding is turned off.",
  disabled = false,
  link,
  cancelLabel = "Cancel",
  another,
}: {
  /** The primary: "Add a booking". */
  action: string;
  onAction: () => void;
  /** The primary shows `busyLabel` while the write runs, and the sheet holds on. */
  busy?: boolean;
  busyLabel?: string;
  demo?: boolean;
  /** What the line above says in demonstration mode, for a sheet that records or books rather than adds. */
  demoLine?: string;
  /** The primary can't be pressed yet (a receipt is still uploading), though it isn't demonstration mode. */
  disabled?: boolean;
  /** An optional rose link under the row: "Delete". */
  link?: ReactNode;
  /** The quiet button that closes the sheet: "Done" where the sheet adds several things. */
  cancelLabel?: string;
  /**
   * "Add and start another" (guide §6.13): a second add that keeps the sheet
   * open for the next one. It takes Cancel's place, and Escape still closes.
   */
  another?: { label: string; onAction: () => void; busyLabel?: string; busy?: boolean };
}) {
  const sheet = useSheet();
  const { connection } = useSession();
  const inDemo = demo ?? connection === "demo";
  useBusy(sheet, busy || Boolean(another?.busy));

  // Escape or a tap outside with text typed in: ask once before throwing it away
  // (N18). A second one closes. Cancel is a clear choice, so it closes at once.
  const [asked, setAsked] = useState(false);
  const askedRef = useRef(false);
  useEffect(() => {
    sheet.setGuard(() => {
      if (inDemo || askedRef.current || !sheet.changed()) return true;
      askedRef.current = true;
      setAsked(true);
      sheet.focusFirstField();
      return false;
    });
    return () => sheet.setGuard(null);
  }, [sheet, inDemo]);

  return (
    <>
      {inDemo && <p className={styles.demo}>{demoLine}</p>}
      {asked && (
        <p className={styles.hold} role="alert">
          {STARTED_TYPING}
        </p>
      )}
      <SheetActions>
        {another ? (
          <Btn
            variant="quiet"
            disabled={inDemo || busy}
            busy={another.busy}
            busyLabel={another.busyLabel}
            onClick={another.onAction}
          >
            {another.label}
          </Btn>
        ) : (
          <Btn variant="quiet" disabled={busy} onClick={sheet.close}>
            {cancelLabel}
          </Btn>
        )}
        <Btn disabled={inDemo || disabled || Boolean(another?.busy)} busy={busy} busyLabel={busyLabel} onClick={onAction}>
          {action}
        </Btn>
      </SheetActions>
      {(asked || link) && (
        <div className={styles.link}>
          {asked && (
            <TextLink tone="rose" onClick={sheet.close}>
              {CLOSE_WITHOUT_ADDING}
            </TextLink>
          )}
          {link}
        </div>
      )}
    </>
  );
}

/**
 * The foot of a sheet that edits something that exists (guide §4.14): the save
 * line, then one Done, then an optional rose link. Done, Escape and a tap outside
 * never throw a change away (N18). While one is saving they wait ("Saving, then
 * this closes") and the sheet closes once it has. If it didn't save, or can't be
 * saved yet (`blocked` counts the changes that are missing something, N9), the
 * sheet stays open and says so, with Try again and "close without it", which
 * closes and says the change wasn't saved.
 */
export function EditSheetActions({
  link,
  onDone,
  before,
  blocked = 0,
  blockedLine,
  onBlocked,
}: {
  link?: ReactNode;
  onDone?: () => void;
  /** Quiet actions that come before Done, such as the event sheet's "Mark completed". */
  before?: ReactNode;
  blocked?: number;
  /** While changes are blocked, the save line says which ones: "1 change not saved yet: the end time". */
  blockedLine?: string | null;
  /** Done, Escape or a tap outside was refused for a blocked change: the screen moves to the field. */
  onBlocked?: () => void;
}) {
  const sheet = useSheet();
  const scope = useContext(SaveScopeContext);
  const toast = useOptionalToast();
  const kind = scope?.line.kind ?? "idle";
  const failed = kind === "failed";
  const stuck = failed || blocked > 0;

  // What the guard reads when a dismissal asks, without re-registering it each render.
  const now = useRef({ kind, stuck });
  useEffect(() => {
    now.current = { kind, stuck };
  });

  const [refused, setRefused] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const ask = useCallback(() => {
    const { kind: current, stuck: held } = now.current;
    if (held) {
      setWaiting(false);
      setRefused((n) => n + 1);
      return false;
    }
    if (current === "saving") {
      setWaiting(true);
      return false;
    }
    return true;
  }, []);
  useEffect(() => {
    sheet.setGuard(ask);
    return () => sheet.setGuard(null);
  }, [sheet, ask]);

  // Waiting for a save: it landed, so close. If it failed, the held line below says so.
  useEffect(() => {
    if (waiting && !stuck && kind !== "saving") sheet.close();
  }, [waiting, stuck, kind, sheet]);

  // A refused dismissal for a blocked change takes the person to the field.
  const onBlockedRef = useRef(onBlocked);
  useEffect(() => {
    onBlockedRef.current = onBlocked;
  });
  useEffect(() => {
    if (refused > 0 && blocked > 0) onBlockedRef.current?.();
  }, [refused, blocked]);

  const held = stuck && (refused > 0 || waiting);
  const tryAgain = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (held) tryAgain.current?.focus();
  }, [held, refused]);

  const loseIt = () => {
    sheet.close();
    toast?.confirmation(CLOSED_WITHOUT);
  };

  let line: ReactNode = <SaveLine held={blocked > 0 ? blockedLine : null} />;
  if (scope && held) {
    line = (
      <p className={`${fieldStyles.saveLine} ${fieldStyles.saveFailed}`} role="alert">
        {failed ? HELD_FAILED : heldBlocked(blocked)}{" "}
        {failed && (
          <>
            <button
              ref={tryAgain}
              type="button"
              className={`${fieldStyles.link} ${fieldStyles.rose}`}
              onClick={scope.retryAll}
            >
              {TRY_AGAIN}
            </button>{" "}
            or{" "}
          </>
        )}
        <button type="button" className={fieldStyles.link} onClick={loseIt}>
          {CLOSE_WITHOUT_IT}
        </button>
      </p>
    );
  } else if (scope && waiting) {
    line = (
      <p className={fieldStyles.saveLine} role="status">
        {SAVING_THEN_CLOSE}
      </p>
    );
  }

  return (
    <>
      {scope && <div className={styles.save}>{line}</div>}
      <SheetActions>
        {before}
        <Btn onClick={() => ask() && (onDone ?? sheet.close)()}>Done</Btn>
      </SheetActions>
      {link && <div className={styles.link}>{link}</div>}
    </>
  );
}
