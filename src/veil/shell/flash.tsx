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

/** Guide §2.4: a 2.4s rose-wash fade on a row that just changed. Matches --motion-flash. */
export const FLASH_MS = 2400;

export interface FlashTarget {
  kind: string;
  id: string;
  partId?: string;
}

const keyOf = ({ kind, id, partId }: FlashTarget) => `${kind}:${id}${partId ? `:${partId}` : ""}`;

type Flasher = (targets: FlashTarget | FlashTarget[]) => void;

interface FlashContextValue {
  flash: Flasher;
  /** key → how many times it has flashed; the parity restarts the animation. */
  active: ReadonlyMap<string, number>;
}

const FlashContext = createContext<FlashContextValue | null>(null);

/**
 * Holds which rows are flashing. A row or card asks `useFlash(target)` for its
 * class; the partner's news (partner-news.tsx) and a screen's own just-added
 * and just-changed rows call `useFlasher()`.
 */
export function FlashProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ReadonlyMap<string, number>>(new Map());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const live = timers.current;
    return () => {
      live.forEach((timer) => clearTimeout(timer));
      live.clear();
    };
  }, []);

  const flash = useCallback<Flasher>((targets) => {
    const keys = (Array.isArray(targets) ? targets : [targets]).map(keyOf);
    if (keys.length === 0) return;
    setActive((prev) => {
      const next = new Map(prev);
      for (const key of keys) next.set(key, (prev.get(key) ?? 0) + 1);
      return next;
    });
    for (const key of keys) {
      clearTimeout(timers.current.get(key));
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          setActive((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
          });
        }, FLASH_MS),
      );
    }
  }, []);

  const value = useMemo(() => ({ flash, active }), [flash, active]);
  return <FlashContext.Provider value={value}>{children}</FlashContext.Provider>;
}

function useFlashContext(): FlashContextValue {
  const ctx = useContext(FlashContext);
  if (!ctx) throw new Error("useFlash needs a FlashProvider above it");
  return ctx;
}

/** Makes rows flash: `flash(target)` or `flash([row, card])`. */
export function useFlasher(): Flasher {
  return useFlashContext().flash;
}

/**
 * The class for a row or card: "flash" while it should flash, otherwise "".
 * Flashing again before it fades swaps to "flash again", so the animation
 * restarts instead of carrying on.
 */
export function useFlash(target: FlashTarget): string {
  const { active } = useFlashContext();
  const count = active.get(keyOf(target));
  if (!count) return "";
  return count % 2 === 0 ? "flash again" : "flash";
}
