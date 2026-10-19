"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { readSlots, type AccountSlots } from "@/lib/model/who";

// Which of the two names each account holds (guide §5.1, N3): `slots` maps an
// account's uid to "first" or "second". It sits beside the wedding settings,
// not in them, so saving the settings never touches the pairing.
const COLLECTION = "settings";
const DOC_ID = "accounts";

export function useAccountSlots() {
  const [slots, setSlots] = useState<AccountSlots>({});
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    // A cached "no document" while offline isn't "nobody is paired" (see `useWeddingSettings`).
    return onSnapshot(
      doc(db, COLLECTION, DOC_ID),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.metadata.fromCache && !snapshot.exists()) return;
        setSlots(readSlots(snapshot.data()?.slots));
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing to account pairing:", err);
        setLoading(false);
      },
    );
  }, []);

  return { slots, loading };
}
