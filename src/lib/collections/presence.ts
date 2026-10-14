"use client";

import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { millis, str } from "@/lib/data/adapters/common";
import { requireDb, uidOf } from "@/lib/data/db";
import { guarded } from "@/lib/data/write";

// Who has a document open (guide §6.3: "Bella is also in this document").
// One entry per account and document, refreshed while it stays open; entries
// older than PRESENCE_FRESH_MS count as gone, so a closed laptop drops out.
const COLLECTION = "presence";
export const PRESENCE_FRESH_MS = 2 * 60_000;

export interface Presence {
  documentId: string;
  uid: string;
  at: number | null;
}

const presenceId = (documentId: string, uid: string) => `${documentId}_${uid}`;

export async function markPresent(documentId: string, database?: Firestore) {
  const dbx = requireDb(database);
  const uid = uidOf(dbx);
  if (!uid) return;
  await guarded(() =>
    setDoc(doc(dbx, COLLECTION, presenceId(documentId, uid)), {
      documentId,
      uid,
      at: serverTimestamp(),
    }),
  );
}

export async function markAbsent(documentId: string, database?: Firestore) {
  const dbx = requireDb(database);
  const uid = uidOf(dbx);
  if (!uid) return;
  await guarded(() => deleteDoc(doc(dbx, COLLECTION, presenceId(documentId, uid))));
}

/** Everyone with this document open recently, including this account. */
export function usePresence(documentId: string) {
  const [data, setData] = useState<Presence[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const q = query(collection(db, COLLECTION), where("documentId", "==", documentId));
    return onSnapshot(q, (snapshot) =>
      setData(
        snapshot.docs.map((d) => {
          const data = d.data();
          return { documentId: str(data.documentId), uid: str(data.uid), at: millis(data.at) };
        }),
      ),
    );
  }, [documentId]);

  return data;
}
