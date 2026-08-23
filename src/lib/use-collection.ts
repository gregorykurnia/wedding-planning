"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";

/**
 * Every data collection (venues, vendors, guests, ...) lives nested under a
 * workspace document, so each wedding's data is fully isolated:
 * workspaces/{workspaceId}/{collectionName}/{docId}
 */
function collectionPath(workspaceId: string, collectionName: string): string {
  return `workspaces/${workspaceId}/${collectionName}`;
}

/**
 * Generic realtime Firestore collection hook, scoped to one workspace.
 * Gracefully returns an empty, non-loading state when Firebase isn't
 * configured or no workspace is selected yet, instead of crashing.
 */
export function useCollection<T extends { id: string }>(
  workspaceId: string | null,
  collectionName: string,
  fromDoc: (id: string, data: DocumentData) => T,
  constraints: QueryConstraint[] = [orderBy("createdAt", "asc")],
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !workspaceId) {
      setData([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, collectionPath(workspaceId, collectionName)), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setData(snapshot.docs.map((d) => fromDoc(d.id, d.data())));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error subscribing to ${collectionName}:`, err);
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, collectionName]);

  return { data, loading, error };
}

export async function addDocument(
  workspaceId: string,
  collectionName: string,
  data: Record<string, unknown>,
) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }
  return addDoc(collection(db, collectionPath(workspaceId, collectionName)), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateDocument(
  workspaceId: string,
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }
  return updateDoc(doc(db, collectionPath(workspaceId, collectionName), id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDocument(
  workspaceId: string,
  collectionName: string,
  id: string,
) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }
  return deleteDoc(doc(db, collectionPath(workspaceId, collectionName), id));
}

export function timestampToMillis(ts: unknown): number | null {
  if (
    ts &&
    typeof ts === "object" &&
    "toMillis" in ts &&
    typeof (ts as { toMillis: () => number }).toMillis === "function"
  ) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  return null;
}
