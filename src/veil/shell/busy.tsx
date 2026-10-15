"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type BusyValue = { busy: boolean; claim: () => () => void };

const BusyContext = createContext<BusyValue>({ busy: false, claim: () => () => {} });

/**
 * Whether `main` is busy (guide §4.19, §6.6). A screen that is loading holds a
 * claim, and `main` is `aria-busy` while any claim is held. Claims count, so
 * two loading parts on one screen don't release each other.
 */
export function BusyProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState(0);
  const claim = useCallback(() => {
    setClaims((count) => count + 1);
    return () => setClaims((count) => count - 1);
  }, []);
  const value = useMemo(() => ({ busy: claims > 0, claim }), [claims, claim]);
  return <BusyContext.Provider value={value}>{children}</BusyContext.Provider>;
}

/** True while some mounted screen is loading. */
export function useBusy(): boolean {
  return useContext(BusyContext).busy;
}

/** Holds a claim on `main` for as long as `active` is true. */
export function useBusyClaim(active: boolean): void {
  const { claim } = useContext(BusyContext);
  useEffect(() => {
    if (!active) return;
    return claim();
  }, [active, claim]);
}
