"use client";

import { useSyncExternalStore } from "react";

const STANDALONE = "(display-mode: standalone)";

function subscribe(onChange: () => void) {
  const mode = window.matchMedia(STANDALONE);
  mode.addEventListener("change", onChange);
  return () => mode.removeEventListener("change", onChange);
}

/** Running from the home screen: the standalone display mode, or Safari's own flag on an iPhone. */
function read() {
  return (
    window.matchMedia(STANDALONE).matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Whether the planner is open as an installed app on this device. False on the server and the first render. */
export function useInstalled(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
