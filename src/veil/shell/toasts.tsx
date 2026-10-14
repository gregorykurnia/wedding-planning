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
import styles from "./toasts.module.css";

/** Guide §4.16: 6 seconds, and the undo window lasts exactly as long. */
export const TOAST_MS = 6000;
/** Partner toasts stay a little longer (guide §6.3). */
export const PARTNER_TOAST_MS = 9000;

type ToastKind = "confirmation" | "undo" | "next" | "partner" | "demo";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: ReactNode;
  /** The partner's name; the circle shows its first letter. */
  partner?: string;
  action?: { label: string; run: () => void | Promise<void> };
  /** Undo was tapped and the restore hasn't finished. */
  restoring: boolean;
}

export interface Toasts {
  /** "Saved", "Added Bunga Melati Florist". */
  confirmation(message: ReactNode): number;
  /** "Removed Villa Samaya Ubud · Undo". `undo` resolves when the item is back. */
  undoable(message: ReactNode, undo: () => void | Promise<void>): number;
  /** "Kebun Bunga Atelier is now a booking · Open". */
  next(message: ReactNode, label: string, open: () => void): number;
  /** "Bella recorded Rp 55.500.000 for Dapur Lestari Catering". */
  partner(name: string, message: ReactNode): number;
  /** "Not saved: demonstration mode". */
  demo(): number;
  dismiss(id: number): void;
}

interface ToastContextValue {
  toasts: Toasts;
  setLifted: (lifted: boolean) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): Toasts {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast needs a ToastHost above it");
  return ctx.toasts;
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

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [lifted, setLifted] = useState(false);
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

  const toasts = useMemo<Toasts>(() => {
    const add = (item: Omit<ToastItem, "id" | "restoring">, ms: number) => {
      const id = ++nextId.current;
      setItems((all) => [...all, { ...item, id, restoring: false }]);
      startTimer(id, ms);
      return id;
    };
    return {
      confirmation: (message) => add({ kind: "confirmation", message }, TOAST_MS),
      undoable: (message, undo) =>
        add({ kind: "undo", message, action: { label: "Undo", run: undo } }, TOAST_MS),
      next: (message, label, open) =>
        add({ kind: "next", message, action: { label, run: open } }, TOAST_MS),
      partner: (name, message) =>
        add({ kind: "partner", message, partner: name }, PARTNER_TOAST_MS),
      demo: () => add({ kind: "demo", message: "Not saved: demonstration mode" }, TOAST_MS),
      dismiss,
    };
  }, [startTimer, dismiss]);

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
    } catch {
      // Nothing was put back. The button goes back to Undo for another window
      // so nothing is lost silently. What the toast says about it waits for
      // need N13, which Task 3.8 picks up.
      setRestoring(item.id, false);
      startTimer(item.id, TOAST_MS);
    }
  }

  const value = useMemo(() => ({ toasts, setLifted }), [toasts]);

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
              <span className={styles.ava} aria-hidden="true">
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
