"use client";

import { useState, useSyncExternalStore } from "react";

const DISMISSED = "veil.install-suggestion.dismissed";
const PHONE = "(max-width: 760px)";

function subscribe(onChange: () => void) {
  const phone = window.matchMedia(PHONE);
  phone.addEventListener("change", onChange);
  return () => phone.removeEventListener("change", onChange);
}

/** On a phone, and not already running as an installed app. */
function onPhoneBrowser() {
  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia(PHONE).matches && !installed;
}

function wasDismissed() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false; // Storage can be blocked; the card just shows again next time.
  }
}

/**
 * Whether to suggest adding the planner to the home screen (guide §4.30): on a
 * phone, not already installed, and not turned away before on this device.
 * Task 6.4 adds the Android install prompt and the iPhone steps; this is the
 * gate they share.
 */
export function useInstallSuggestion() {
  const eligible = useSyncExternalStore(subscribe, onPhoneBrowser, () => false);
  const [dismissed, setDismissed] = useState(wasDismissed);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED, "1");
    } catch {
      // Not remembered, but it is gone for now.
    }
  }

  return { show: eligible && !dismissed, dismiss };
}
