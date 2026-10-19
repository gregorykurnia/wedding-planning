"use client";

import { useCallback, useEffect, useReducer, useSyncExternalStore } from "react";
import {
  pushSetupState,
  pushState,
  setUpThisDevice,
  subscribePushSetup,
  type PushState,
  type SetupState,
} from "@/lib/data/push";
import { useSession } from "@/lib/data/session";

/** `checking` until the browser has been asked, so the server's page shows no note at all. */
export type DevicePermission = PushState | "checking";

export type { SetupState };

const read = (): DevicePermission => pushState();

/** Browsers that have the Permissions API say when the permission changes in their own settings. */
function subscribePermission(onChange: () => void) {
  let status: PermissionStatus | null = null;
  let gone = false;
  navigator.permissions
    ?.query({ name: "notifications" as PermissionName })
    .then((s) => {
      if (gone) return;
      status = s;
      s.addEventListener("change", onChange);
    })
    .catch(() => {});
  return () => {
    gone = true;
    status?.removeEventListener("change", onChange);
  };
}

/**
 * What this device allows for reminders, and a way to ask (S10, N6). Once
 * allowed, and on every visit after while signed in, this device is saved so
 * the daily run reaches it. Demonstration mode only reads.
 */
export function useNotificationPermission(): {
  permission: DevicePermission;
  allow: () => Promise<DevicePermission>;
  setup: SetupState;
  retrySetup: () => void;
} {
  const permission = useSyncExternalStore(subscribePermission, read, () => "checking" as DevicePermission);
  const setup = useSyncExternalStore(subscribePushSetup, pushSetupState, () => "idle" as SetupState);
  const [, reread] = useReducer((n: number) => n + 1, 0);
  const { status } = useSession();
  const signedIn = status === "signed-in";

  useEffect(() => {
    if (signedIn && permission === "granted") void setUpThisDevice();
  }, [signedIn, permission]);

  const allow = useCallback(async () => {
    if (typeof Notification === "undefined") return read();
    await Notification.requestPermission();
    reread();
    const now = read();
    if (now === "granted" && signedIn) void setUpThisDevice(true);
    return now;
  }, [signedIn]);

  const retrySetup = useCallback(() => void setUpThisDevice(true), []);

  return { permission, allow, setup, retrySetup };
}
