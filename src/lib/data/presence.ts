"use client";

import { useEffect, useState } from "react";
import { markAbsent, markPresent, usePresence } from "@/lib/collections/presence";
import { PRESENCE_HEARTBEAT_MS, partnerIsHere } from "@/lib/model/partner";
import { usePartnerName } from "./partner";
import { useSession } from "./session";

/** How often "also here" is worked out again, so a stale heartbeat expires on its own. */
const RECHECK_MS = 5_000;

function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}

/**
 * For a document that is open (guide §6.3): beats every 20 seconds while the
 * page is showing, stops when it is hidden or closed, and says whether the
 * other account's beat is under 45 seconds old. Presence is best-effort: a
 * failed beat is skipped, never shown.
 */
export function useDocumentPresence(documentId: string | null): { partnerHere: boolean; partner: string } {
  const { user } = useSession();
  const uid = user?.uid ?? null;
  const { name } = usePartnerName();
  const entries = usePresence(documentId ?? "");
  const now = useNow(RECHECK_MS);

  useEffect(() => {
    if (!documentId || !uid) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const beat = () => void markPresent(documentId).catch(() => {});
    const start = () => {
      if (timer) return;
      beat();
      timer = setInterval(beat, PRESENCE_HEARTBEAT_MS);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = undefined;
      void markAbsent(documentId).catch(() => {});
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : stop());

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", stop);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, [documentId, uid]);

  return { partnerHere: !!documentId && partnerIsHere(entries, uid, now), partner: name };
}
