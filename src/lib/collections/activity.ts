"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type DocumentData,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { isObject, millis, str, strOrNull } from "@/lib/data/adapters/common";
import type { ActivityParams, ActivityTarget } from "@/lib/data/activity";
import type { DeviceKind } from "@/lib/model/partner";

// Partner news written by logActivity() (src/lib/data/activity.ts). Entries
// are never edited; the screen keeps only those from the other account.
const COLLECTION = "activity";

export interface ActivityEntry {
  id: string;
  by: string | null;
  at: number | null;
  kind: string;
  params: ActivityParams;
  target: ActivityTarget | null;
  /** The browser that made the change (N3); null on entries from before it was kept. */
  device: string | null;
  deviceKind: DeviceKind | null;
}

export function activityFromDoc(id: string, data: DocumentData): ActivityEntry {
  const target = isObject(data.target) && typeof data.target.id === "string"
    ? {
        kind: str(data.target.kind),
        id: data.target.id,
        ...(typeof data.target.partId === "string" ? { partId: data.target.partId } : {}),
      }
    : null;
  return {
    id,
    by: strOrNull(data.by),
    at: millis(data.at),
    kind: str(data.kind),
    params: isObject(data.params) ? (data.params as ActivityParams) : {},
    target,
    device: strOrNull(data.device),
    deviceKind: data.deviceKind === "phone" || data.deviceKind === "computer" ? data.deviceKind : null,
  };
}

/** Entries made since `sinceMs` (usually when the screen opened), oldest first. */
export function useActivitySince(sinceMs: number) {
  const [data, setData] = useState<ActivityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const q = query(
      collection(db, COLLECTION),
      where("at", ">", Timestamp.fromMillis(sinceMs)),
      orderBy("at", "asc"),
    );
    return onSnapshot(
      q,
      (snapshot) => setData(snapshot.docs.map((d) => activityFromDoc(d.id, d.data()))),
      (err) => setError(err.message),
    );
  }, [sinceMs]);

  return { data, error };
}
