"use client";

import { useOnline } from "@/lib/data/session";
import { offlineOr } from "@/lib/model/save-state";

/**
 * A failure's words, or "Not saved: you’re offline" while the device is
 * offline (guide §6.6), for lines that don't read the connection themselves.
 */
export function OfflineOr({ children }: { children: string }) {
  const offline = !useOnline();
  return <>{offlineOr(children, offline)}</>;
}
