"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { WriteError } from "@/lib/data/write-error";
import { UNDO_CONFLICT_OWN, undoConflict } from "@/lib/model/confirm-text";
import styles from "./toasts.module.css";

/** Guide §4.16: 6 seconds, and the undo window lasts exactly as long. */
export const TOAST_MS = 6000;
/** Partner toasts stay a little longer (guide §6.3). */
export const PARTNER_TOAST_MS = 9000;

/** A conflict sentence, or one made from the partner's name, which the host knows. */
type Conflict = ReactNode | ((partner: string) => ReactNode);

type ToastKind = "confirmation" | "undo" | "next" | "partner" | "demo";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: ReactNode;
  /** The partner's name; the circle shows its first letter. */
  partner?: string;
  /** The circle is yours, in champagne: a change from your other device (N3). */
  own?: boolean;
  action?: { label: string; run: () => void | Promise<void> };
  /** What an Undo that finds the thing changed since says (N13); the generic line if not given. */
  conflict?: Conflict;
  /** The same, when the change since was your own (G35); the generic line if not given. */
  ownConflict?: ReactNode;
  /** Undo was tapped and the restore hasn't finished. */
  restoring: boolean;
}

export interface Toasts {
  /** "Saved", "Added Bunga Melati Florist". */
  confirmation(message: ReactNode): number;
  /**
   * "Removed Villa Samaya Ubud · Undo". `undo` resolves when the item is back.
   * If it rejects with a `changed` WriteError (the partner, or you, changed the
   * same thing since), nothing is taken back and a 9-second partner toast says
   * so: `conflict` is its sentence, "Can’t undo the split: Bella recorded …".
   * When the change since was your own, the toast says `ownConflict` instead,
   * with no circle, rather than naming the partner for it.
   */
  undoable(
    message: ReactNode,
    undo: () => void | Promise<void>,
    conflict?: Conflict,
    ownConflict?: ReactNode,
  ): number;
  /** "Kebun Bunga Atelier is now a booking · Open". */
  next(message: ReactNode, label: string, open: () => void): number;
  /** "Bella recorded Rp 55.500.000 for Dapur Lestari Catering". */
  partner(name: string, message: ReactNode): number;
  /**
   * "You recorded Rp 55.500.000 for Dapur Lestari Catering on your other phone":
   * your own initial in champagne, 9 seconds, never shown as the partner's (N3).
   */
  own(name: string, message: ReactNode): number;
  /** "Not saved: demonstration mode". */
  demo(): number;
  dismiss(id: number): void;
}

interface ToastContextValue {
  toasts: Toasts;
  setLifted: (lifted: boolean) => void;
  /** Who the conflict toast's circle shows, set by whoever knows (`useToastPartnerName`). */
  setPartnerName: (name: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): Toasts {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast needs a ToastHost above it");
  return ctx.toasts;
}

/** The same, for a part that may be shown with no host above it (a sheet's foot): null then. */
export function useOptionalToast(): Toasts | null {
  return useContext(ToastContext)?.toasts ?? null;
}

/**
 * On a phone the toasts sit higher while this is mounted, clear of the
 * document editor's toolbar (guide §4.16: 120px instead of 90px).
 */
export function useEditorToasts() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useEditorToasts needs a ToastHost above it");
  const { setLifted } = ctx;
  useEffect(() => {
    setLifted(true);
    return () => setLifted(false);
  }, [setLifted]);
}

/**
 * Tells the toast host who the partner is, for the "Can’t undo" toast (N13).
 * Mounted by the providers while an allowed account is signed in, where the
 * name can be read; "Your partner" until then.
 */
export function useToastPartnerName(name: string) {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastPartnerName needs a ToastHost above it");
  const { setPartnerName } = ctx;
  useEffect(() => {
    setPartnerName(name);
  }, [setPartnerName, name]);
}

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [lifted, setLifted] = useState(false);
  const partnerNameRef = useRef("Your partner");
  const setPartnerName = useCallback((name: string) => {
    partnerNameRef.current = name;
  }, []);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const stopTimer = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      stopTimer(id);
      setItems((all) => all.filter((t) => t.id !== id));
    },
    [stopTimer],
  );

  const startTimer = useCallback(
    (id: number, ms: number) => {
      stopTimer(id);
      timers.current.set(id, setTimeout(() => dismiss(id), ms));
    },
    [stopTimer, dismiss],
  );

  useEffect(() => {
    const live = timers.current;
    return () => {
      live.forEach((timer) => clearTimeout(timer));
      live.clear();
    };
  }, []);

  const add = useCallback(
    (item: Omit<ToastItem, "id" | "restoring">, ms: number) => {
      const id = ++nextId.current;
      setItems((all) => [...all, { ...item, id, restoring: false }]);
      startTimer(id, ms);
      return id;
    },
    [startTimer],
  );

  const toasts = useMemo<Toasts>(() => {
    return {
      confirmation: (message) => add({ kind: "confirmation", message }, TOAST_MS),
      undoable: (message, undo, conflict, ownConflict) =>
        add({ kind: "undo", message, conflict, ownConflict, action: { label: "Undo", run: undo } }, TOAST_MS),
      next: (message, label, open) =>
        add({ kind: "next", message, action: { label, run: open } }, TOAST_MS),
      partner: (name, message) =>
        add({ kind: "partner", message, partner: name }, PARTNER_TOAST_MS),
      own: (name, message) =>
        add({ kind: "partner", message, partner: name, own: true }, PARTNER_TOAST_MS),
      demo: () => add({ kind: "demo", message: "Not saved: demonstration mode" }, TOAST_MS),
      dismiss,
    };
  }, [add, dismiss]);

  const setRestoring = useCallback((id: number, restoring: boolean) => {
    setItems((all) => all.map((t) => (t.id === id ? { ...t, restoring } : t)));
  }, []);

  async function act(item: ToastItem) {
    if (!item.action || item.restoring) return;
    if (item.kind !== "undo") {
      // A next step (Open) acts at once and the toast has done its job.
      dismiss(item.id);
      void item.action.run();
      return;
    }
    // Undo: the window stays open while the restore is under way, so the toast
    // can't vanish before the item is back.
    stopTimer(item.id);
    setRestoring(item.id, true);
    try {
      await item.action.run();
      dismiss(item.id);
    } catch (err) {
      if (err instanceof WriteError && err.code === "changed") {
        // The same thing was changed since (N13): nothing is taken back, there
        // is nothing left to try, and what is there now stays. The toast says so.
        dismiss(item.id);
        if (err.by === "you") {
          add({ kind: "partner", message: item.ownConflict ?? UNDO_CONFLICT_OWN }, PARTNER_TOAST_MS);
        } else {
          const partner = partnerNameRef.current;
          const said = typeof item.conflict === "function" ? item.conflict(partner) : item.conflict;
          toasts.partner(partner, said ?? undoConflict(partner));
        }
        return;
      }
      // Nothing was put back. The button goes back to Undo for another window
      // so nothing is lost silently.
      setRestoring(item.id, false);
      startTimer(item.id, TOAST_MS);
    }
  }

  const value = useMemo(() => ({ toasts, setLifted, setPartnerName }), [toasts, setPartnerName]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className={styles.toasts}
        data-placement={lifted ? "editor" : undefined}
        role="status"
        aria-live="polite"
      >
        {items.map((item) => (
          <div key={item.id} className={styles.toast} data-kind={item.kind}>
            {item.partner && (
              <span className={item.own ? `${styles.ava} ${styles.self}` : styles.ava} aria-hidden="true">
                {Array.from(item.partner)[0]?.toUpperCase()}
              </span>
            )}
            <span className={styles.message} dir="auto">
              {item.message}
            </span>
            {item.action && (
              <button
                type="button"
                className={styles.action}
                disabled={item.restoring}
                onClick={() => void act(item)}
              >
                {item.restoring ? "Restoring" : item.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
