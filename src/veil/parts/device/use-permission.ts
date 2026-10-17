"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import type { Permission } from "./notification-state";

/** `unsupported` is a browser with no notification API (N6, which Task 6.2 words); nothing is shown for it yet. */
export type DevicePermission = Permission | "unsupported";

const read = (): DevicePermission => {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
};

// The browser has no event for a changed permission that every browser sends, so the screen re-reads after asking.
const subscribe = () => () => {};

/**
 * What this device allows, read from the browser, and a way to ask. Asking only
 * raises the browser's own question; storing the subscription so reminders reach
 * this device belongs to Task 6.2.
 */
export function useNotificationPermission(): { permission: DevicePermission; allow: () => Promise<DevicePermission> } {
  // The server and the first client render agree on "unsupported"; the real answer comes right after.
  const current = useSyncExternalStore(subscribe, read, () => "unsupported" as DevicePermission);
  const [asked, setAsked] = useState<DevicePermission | null>(null);
  const allow = useCallback(async () => {
    if (typeof Notification === "undefined") return "unsupported" as const;
    await Notification.requestPermission();
    const now = read();
    setAsked(now);
    return now;
  }, []);
  return { permission: asked ?? current, allow };
}
