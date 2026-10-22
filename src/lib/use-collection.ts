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
import { readAnswer } from "@/lib/collection-answers";

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

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      return;
    }
    arrived.current = false;
    const q = query(collection(db, collectionName), ...constraints);
    // With metadata changes, so a read held offline hears the server's answer
    // even when the collection is empty and nothing else changes (P7-S14).
    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const verdict = readAnswer({
          name: collectionName,
          arrived: arrived.current,
          fromCache: snapshot.metadata.fromCache,
          empty: snapshot.empty,
          changed: snapshot.docChanges().length > 0,
          online: navigator.onLine,
        });
        if (verdict !== "take") return;
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
    return unsubscribe;
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
