"use client";

import { useEffect, useRef } from "react";
import { collection, limit, onSnapshot, orderBy, query, type DocumentData } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { isObject, millis, str, strOrNull } from "@/lib/data/adapters/common";
import type { ActivityParams, ActivityTarget } from "@/lib/data/activity";
import { activityNews, type DeviceKind } from "@/lib/model/partner";

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

/** How many of the latest entries are watched: more than two people make between two snapshots. */
const WINDOW = 50;

/**
 * Calls `onNews` with each batch of entries added after this mounted, oldest
 * first (`activityNews` in src/lib/model/partner.ts says which are new). Only
 * the latest entries are watched, so a tab left open for days holds no more.
 */
export function useActivityNews(onNews: (entries: ActivityEntry[]) => void) {
  const latest = useRef(onNews);
  useEffect(() => {
    latest.current = onNews;
  });

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const news = activityNews();
    const q = query(collection(db, COLLECTION), orderBy("at", "desc"), limit(WINDOW));
    // Metadata changes too, so the move from the cache to the server's answer
    // is seen even when it changes no entry.
    return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const changes = snapshot.docChanges().filter((c) => c.type === "added");
      const fresh = new Set(
        news({ fromCache: snapshot.metadata.fromCache, added: changes.map((c) => c.doc.id) }),
      );
      if (fresh.size === 0) return;
      const entries = changes
        .filter((c) => fresh.has(c.doc.id))
        .map((c) => activityFromDoc(c.doc.id, c.doc.data()))
        .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity));
      latest.current(entries);
    });
  }, []);
}
