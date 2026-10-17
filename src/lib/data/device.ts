import type { DeviceKind } from "@/lib/model/partner";

const KEY = "veil.device";
let memory: string | null = null;

/**
 * An id for this browser, kept in `localStorage` (a private window or blocked
 * storage keeps it for the page's life only). Every `activity` entry carries
 * it, so a change from your own other device can be told from one made here
 * (guide §6.3, N3).
 */
export function deviceId(): string {
  if (memory) return memory;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return (memory = stored);
  } catch {
    // No storage: this page's own id will do.
  }
  const made = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  memory = made;
  try {
    localStorage.setItem(KEY, made);
  } catch {
    // Kept in memory only.
  }
  return made;
}

/** "Phone" at the design's phone width (760px and under), otherwise a computer. */
export function deviceKind(): DeviceKind {
  try {
    return window.matchMedia("(max-width: 760px)").matches ? "phone" : "computer";
  } catch {
    return "computer";
  }
}
