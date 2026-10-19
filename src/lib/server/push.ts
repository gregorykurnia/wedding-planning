import webpush from "web-push";
import { ALLOWED_EMAILS } from "./allowlist";
import { RequestError } from "./request-error";

/**
 * Web push with VAPID keys (S10; plan §2.9, Task 6.2). The public key is also
 * in the browser (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`), which subscribes with it;
 * the private key lives only on the server (`VAPID_PRIVATE_KEY`). Make a pair
 * with `npx web-push generate-vapid-keys`.
 */
export interface PushConfig {
  publicKey: string;
  privateKey: string;
  /** Who push services can contact about these pushes. */
  subject: string;
}

export function pushConfig(): PushConfig {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new RequestError(503, "not-configured", "NEXT_PUBLIC_VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is not set");
  }
  return { publicKey, privateKey, subject: `mailto:${ALLOWED_EMAILS[0]}` };
}

/** A stored subscription, as the browser gave it. */
export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * What one send did: `sent`, `gone` (the push service has forgotten this
 * device, so its subscription should be removed), or `failed` (try another
 * day).
 */
export type SendResult = "sent" | "gone" | "failed";

export type SendPush = (subscription: StoredSubscription, payload: string) => Promise<SendResult>;

/** Only real push services: an endpoint is a public https address. */
export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string") return false;
  try {
    return new URL(endpoint).protocol === "https:";
  } catch {
    return false;
  }
}

/** Sends one push with `web-push`. A reminder is of no use after half a day, so the push service drops it then. */
export function webPushSender(config: PushConfig): SendPush {
  return async (subscription, payload) => {
    if (!isPushEndpoint(subscription.endpoint)) return "gone";
    try {
      await webpush.sendNotification(subscription, payload, {
        vapidDetails: config,
        TTL: 12 * 60 * 60,
        urgency: "normal",
        timeout: 15_000,
      });
      return "sent";
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone";
      console.error("Push failed", status ?? "", err instanceof Error ? err.message : err);
      return "failed";
    }
  };
}
