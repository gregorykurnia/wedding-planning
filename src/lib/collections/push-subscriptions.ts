"use client";

import { deleteDoc, doc, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import { requireDb, uidOf } from "@/lib/data/db";
import { WriteError } from "@/lib/data/write-error";
import { guarded } from "@/lib/data/write";

// A device's web push subscription (S10). Each account reads and writes only
// its own; the daily reminder job reads them all with the Admin SDK.
const COLLECTION = "pushSubscriptions";

/** A stable document id for an endpoint (endpoints are long URLs with slashes). */
export function subscriptionId(endpoint: string): string {
  // FNV-1a, twice with different seeds, for a short id with no slashes.
  const hash = (seed: number) => {
    let h = seed;
    for (let i = 0; i < endpoint.length; i++) {
      h ^= endpoint.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36);
  };
  return `${hash(2166136261)}${hash(374761393)}`;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function savePushSubscription(
  subscription: PushSubscriptionInput,
  device: string,
  database?: Firestore,
) {
  const dbx = requireDb(database);
  const uid = uidOf(dbx);
  if (!uid) throw new WriteError("denied", "Not signed in");
  await guarded(() =>
    setDoc(doc(dbx, COLLECTION, subscriptionId(subscription.endpoint)), {
      uid,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      device,
      updatedAt: serverTimestamp(),
    }),
  );
}

export async function removePushSubscription(endpoint: string, database?: Firestore) {
  const dbx = requireDb(database);
  await guarded(() => deleteDoc(doc(dbx, COLLECTION, subscriptionId(endpoint))));
}
