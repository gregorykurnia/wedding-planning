"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc, type DocumentData } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { timestampToMillis } from "@/lib/use-collection";
import type { WeddingSettings } from "@/lib/types";

const COLLECTION = "settings";
const DOC_ID = "wedding";

function fromDoc(data: DocumentData | undefined): WeddingSettings {
  return {
    yourName: data?.yourName ?? "",
    partnerName: data?.partnerName ?? "",
    weddingDate: data?.weddingDate ?? null,
    partnerEmail: data?.partnerEmail ?? "",
    venue: data?.venue ?? "",
    updatedAt: timestampToMillis(data?.updatedAt),
  };
}

export function useWeddingSettings() {
  const [data, setData] = useState<WeddingSettings | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, COLLECTION, DOC_ID),
      (snapshot) => {
        setData(fromDoc(snapshot.data()));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("Error subscribing to wedding settings:", err);
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  return { data, loading, error };
}

export function saveWeddingSettings(data: Omit<WeddingSettings, "updatedAt">) {
  if (!isFirebaseConfigured || !db) {
    throw new Error("Firebase is not configured.");
  }
  return setDoc(doc(db, COLLECTION, DOC_ID), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}
