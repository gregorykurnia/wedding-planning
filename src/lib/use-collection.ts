"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";

/**
 * Generic realtime Firestore collection hook. Gracefully returns an empty,
 * non-loading state when the database isn't configured instead of crashing.
 */
export function useCollection<T extends { id: string }>(
  collectionName: string,
  fromDoc: (id: string, data: DocumentData) => T,
  constraints: QueryConstraint[] = [orderBy("createdAt", "asc")],
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const arrived = useRef(false);
  // For screens: whether any answer has come, so a read that fails before one isn't shown as empty.
  const [answered, setAnswered] = useState(false);
  const held = useRef(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      return;
    }
    arrived.current = false;
    held.current = false;
    // The connection is back: an empty collection sends no new answer, so stop waiting for one.
    const onOnline = () => {
      if (!held.current) return;
      held.current = false;
      arrived.current = true;
      setAnswered(true);
      setLoading(false);
    };
    window.addEventListener("online", onOnline);
    const q = query(collection(db, collectionName), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // With no connection and nothing held on the device, the first answer is an empty one
        // from the cache. That says "nothing has arrived", not "there is nothing": keep loading.
        // (Only when the browser knows it is offline: an empty collection that is online
        // gets no second answer to wait for.)
        if (!arrived.current && snapshot.metadata.fromCache && snapshot.empty && !navigator.onLine) {
          held.current = true;
          return;
        }
        held.current = false;
        arrived.current = true;
        setAnswered(true);
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
    return () => {
      window.removeEventListener("online", onOnline);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  return { data, loading, error, arrived: answered };
}

export async function addDocument(
  collectionName: string,
  data: Record<string, unknown>,
) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }
  return addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateDocument(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }
  return updateDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDocument(collectionName: string, id: string) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }
  return deleteDoc(doc(db, collectionName, id));
}

/**
 * Writes a document using a caller-provided ID. This is useful for restoring
 * a recently deleted document without creating a new record with a different
 * identity.
 */
export async function setDocument(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }
  return setDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
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
