"use client";

import { getAuth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { removePushSubscription, savePushSubscription } from "@/lib/collections/push-subscriptions";
import { requireDb } from "./db";
import { WriteError } from "./write-error";

/**
 * Reminders on this device (S10, N6; plan §2.9, Task 6.2). The browser asks
 * for permission; once it's allowed, this device subscribes with the planner's
 * VAPID public key and the subscription is saved in `pushSubscriptions` under
 * the signed-in account. The daily run sends to every saved device, so both of
 * you get every reminder on every device you allowed.
 *
 * - `granted`, `default`, `denied`: the browser's own permission.
 * - `install`: an iPhone or iPad in the browser. It can only receive pushes
 *   once the planner is on the home screen (iOS 16.4 and later).
 * - `unsupported`: this browser has no web push at all.
 */
export type PushState = "granted" | "default" | "denied" | "install" | "unsupported";

function isAppleMobile(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; a touch screen gives it away.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
  } catch {
    // Old browsers: fall through.
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** What this device can do about reminders, read from the browser. */
export function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  const canPush = typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  if (!canPush) return isAppleMobile() && !isStandalone() ? "install" : "unsupported";
  return Notification.permission;
}

/** A short name for the device, kept with its subscription so the two of you can tell them apart. */
export function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Browser";
}

/** The VAPID public key as the bytes `pushManager.subscribe` takes. */
function serverKey(): Uint8Array<ArrayBuffer> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new WriteError("failed", "NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
  const base64 = (key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) =>
  !!a && a.byteLength === b.byteLength && new Uint8Array(a).every((v, i) => v === b[i]);

/** The site's service worker, once it's running (the shell registers it on every page). */
async function worker(): Promise<ServiceWorkerRegistration> {
  if (!(await navigator.serviceWorker.getRegistration("/"))) {
    await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WriteError("timeout", "The service worker didn't start")), 10_000);
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Subscribes this device (or reuses its subscription) and saves it under the
 * signed-in account. Safe to call on every visit: it writes the same document,
 * and replaces a subscription made with an old key. Needs permission granted.
 */
export async function subscribeThisDevice(opts: { db?: Firestore } = {}): Promise<PushSubscription> {
  const database = requireDb(opts.db);
  if (pushState() !== "granted") throw new WriteError("denied", "Notifications aren't allowed on this device");
  const key = serverKey();
  const registration = await worker();
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe().catch(() => {});
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new WriteError("failed", "The browser gave no push keys");
  await savePushSubscription({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }, deviceLabel(), database);
  return subscription;
}

/**
 * "Send a test reminder": makes sure this device is saved, then asks the
 * server to push to it (`POST /api/push/test`). It should appear in a moment.
 */
export async function sendTestReminder(opts: { db?: Firestore; fetch?: typeof fetch } = {}): Promise<void> {
  const database = requireDb(opts.db);
  const send = opts.fetch ?? fetch;
  const user = getAuth(database.app).currentUser;
  if (!user) throw new WriteError("denied", "Not signed in");
  const subscription = await subscribeThisDevice({ db: database });
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await send("/api/push/test", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch (err) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    throw new WriteError(offline ? "offline" : "failed", "The test didn't reach the server", { cause: err });
  }
  if (res.ok) return;
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  throw new WriteError(
    res.status === 401 || res.status === 403 ? "denied" : "failed",
    body?.message ?? `The server refused the test (${res.status})`,
  );
}

// ---------- saving this device, once per sign-in ----------

/** Saving this device for reminders: `failed` when it was allowed but couldn't be set up (§9.1 G33). */
export type SetupState = "idle" | "working" | "done" | "failed";

let setup: SetupState = "idle";
const listeners = new Set<() => void>();
const setSetup = (next: SetupState) => {
  setup = next;
  listeners.forEach((l) => l());
};

export const pushSetupState = (): SetupState => setup;

export function subscribePushSetup(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Saves this device for reminders, once per sign-in on this page: every block
 * that shows the state shares the one result. `force` tries again after a
 * failure.
 */
export async function setUpThisDevice(force = false): Promise<void> {
  if (setup === "working" || (setup !== "idle" && !force)) return;
  setSetup("working");
  try {
    await subscribeThisDevice();
    setSetup("done");
  } catch {
    setSetup("failed");
  }
}

/**
 * Stops reminders reaching this device, for signing out: removes its saved
 * subscription while still signed in, then drops the browser's own, within
 * three seconds so an offline sign-out isn't held up. Never throws; a
 * subscription left behind is removed by the daily run once the push service
 * forgets it. Signing in again saves the device afresh.
 */
export async function forgetThisDevice(opts: { db?: Firestore } = {}): Promise<void> {
  setSetup("idle");
  const work = (async () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return;
    await removePushSubscription(subscription.endpoint, opts.db).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  })().catch(() => {
    // Signing out goes ahead regardless.
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([work, new Promise<void>((done) => (timer = setTimeout(done, 3_000)))]);
  clearTimeout(timer);
}
