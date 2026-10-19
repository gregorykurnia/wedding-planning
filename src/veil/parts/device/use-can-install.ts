"use client";

import { useSyncExternalStore } from "react";

// Chromium browsers (Android Chrome among them) fire beforeinstallprompt once the
// planner can be installed. The listener is added when this module loads, which
// is before any screen mounts, so an early offer is not missed.
let installable = false;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", () => {
    installable = true;
    listeners.forEach((listen) => listen());
  });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Whether the browser has offered to install the planner on this device. False on the server and the first render. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, () => installable, () => false);
}
