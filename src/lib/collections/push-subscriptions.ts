"use client";

import { deleteDoc, doc, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";
import { requireDb, uidOf } from "@/lib/data/db";
import { WriteError } from "@/lib/data/write-error";
import { guarded } from "@/lib/data/write";
import { PUSH_SUBSCRIPTIONS, subscriptionId } from "@/lib/model/push";

export { subscriptionId };

// A device's web push subscription (S10). Each account reads and writes only
// its own; the daily reminder job reads them all with the Admin SDK.
const COLLECTION = PUSH_SUBSCRIPTIONS;

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
