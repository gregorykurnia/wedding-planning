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
    startedOn: typeof data?.startedOn === "string" ? data.startedOn : null,
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
    // Offline with nothing on the device, the first answer is a cached "no document". That says
    // nothing has arrived, not that there are no settings: answering it would ask for the names
    // again and write over the real ones. Wait for the server (metadata changes on, since a
    // missing document confirmed by the server changes only `fromCache`).
    const unsubscribe = onSnapshot(
      doc(db, COLLECTION, DOC_ID),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache && !snapshot.exists()) return;
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
