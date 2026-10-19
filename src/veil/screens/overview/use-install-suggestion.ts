"use client";

import { useState, useSyncExternalStore } from "react";
import { isIphone, suggestInstall } from "@/lib/model/install";
import { useCanInstall } from "@/veil/parts/device/use-can-install";
import { useInstalled } from "@/veil/parts/device/use-installed";

const DISMISSED = "veil.install-suggestion.dismissed";
const PHONE = "(max-width: 760px)";

function subscribePhone(onChange: () => void) {
  const phone = window.matchMedia(PHONE);
  phone.addEventListener("change", onChange);
  return () => phone.removeEventListener("change", onChange);
}

function noChanges() {
  return () => {};
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
 * Whether to suggest adding the planner to the home screen (guide §4.30), and the
 * "Not now" that keeps it away on this device. The rules are in `suggestInstall`;
 * this reads the device for them.
 */
export function useInstallSuggestion() {
  const phone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
  const installed = useInstalled();
  const installable = useCanInstall();
  const iphone = useSyncExternalStore(noChanges, () => isIphone(navigator.userAgent), () => false);
  const [dismissed, setDismissed] = useState(wasDismissed);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED, "1");
    } catch {
      // Not remembered, but it is gone for now.
    }
  }

  return { show: suggestInstall({ phone, installed, dismissed, iphone, installable }), dismiss };
}
