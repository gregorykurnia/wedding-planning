import type { WriteFailure } from "./write-error";

/**
 * Dev-only failures (plan Task 5.1), so every "couldn't" state can be reached
 * on a preview and in a screenshot without breaking anything for real. They
 * exist only when the build has `NEXT_PUBLIC_VEIL_DEV=1`; in any other build
 * `devFaults()` answers "none" at once and nothing can turn a fault on.
 *
 * `?fault=` takes one or more of these, separated by commas:
 * - `save` (or `save:<code>`, one of the write failures: `failed` by default):
 *   every write fails at once with nothing written, and Try again fails the same.
 *   `save:timeout` is also how to see a write that got no answer.
 * - `load`: every screen read (`readOf`, settings, a document) fails before any data.
 * - `offline`: the device reads as offline, and writes fail as `offline` (what a
 *   write made offline comes to) unless `save:` names another failure. What has
 *   loaded stays on screen, as when the connection drops mid-session.
 * - `offline:cold`: the same, as if offline from the start: no read has anything
 *   to show, so screens say they're offline (a page opened with no connection).
 * - `loading`: every screen read waits forever, so the loading state stays.
 * - `upload`: every file upload fails part-way.
 * `?fault=off` clears them. They stay for the tab (`sessionStorage`), because a
 * move between screens drops the query.
 */
export interface Faults {
  save: WriteFailure | null;
  load: boolean;
  offline: boolean;
  /** With `offline`: nothing had arrived before the connection went. */
  cold: boolean;
  /** Every screen read is held before its first answer. */
  loading: boolean;
  upload: boolean;
}

export const NO_FAULTS: Faults = { save: null, load: false, offline: false, cold: false, loading: false, upload: false };

const SAVE_CODES: readonly WriteFailure[] = ["timeout", "offline", "denied", "missing", "changed", "demo", "failed"];

const STORAGE_KEY = "veil.fault";

/** The faults a `?fault=` value names. Anything it doesn't know is ignored. */
export function parseFaults(spec: string | null | undefined): Faults {
  const faults: Faults = { ...NO_FAULTS };
  for (const part of (spec ?? "").split(",")) {
    const [kind, code] = part.trim().toLowerCase().split(":");
    if (kind === "save") {
      faults.save = SAVE_CODES.find((c) => c === code) ?? "failed";
    } else if (kind === "load" || kind === "offline" || kind === "upload" || kind === "loading") {
      faults[kind] = true;
      if (kind === "offline" && code === "cold") faults.cold = true;
    }
  }
  if (faults.offline && !faults.save) faults.save = "offline";
  return faults;
}

export const devFaultsEnabled = process.env.NEXT_PUBLIC_VEIL_DEV === "1";

let seenSearch: string | null = null;
let current = NO_FAULTS;

function stored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function remember(value: string | null) {
  try {
    if (value === null || value === "off" || value === "") sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Without storage the faults last until the query is dropped.
  }
}

/** The faults in force now: the query's, else the ones kept for this tab. */
export function devFaults(): Faults {
  if (!devFaultsEnabled || typeof window === "undefined") return NO_FAULTS;
  const search = window.location.search;
  if (search !== seenSearch) {
    seenSearch = search;
    const asked = new URLSearchParams(search).get("fault");
    if (asked !== null) remember(asked);
    current = parseFaults(asked ?? stored());
  }
  return current;
}
