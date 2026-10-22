"use client";

import { doc, type Firestore } from "firebase/firestore";
import { sameValue } from "@/lib/data/undo";
import { stamp, transact } from "@/lib/data/write";
import { newId } from "@/lib/data/write";

// guestMeta/counter issues guest numbers. The number is taken and the guest
// written in one transaction, so two people adding at once never share a
// number, and a number is never reused, even after its guest is removed.
const META = "guestMeta";
const COUNTER = "counter";

export async function createNumberedGuest(
  data: Record<string, unknown>,
  opts: { db?: Firestore; id?: string; first?: Record<string, unknown>; superseded?: () => boolean } = {},
): Promise<{ id: string; number: number }> {
  const id = opts.id ?? newId("guests", opts);
  return transact(async (tx, database) => {
    const guestRef = doc(database, "guests", id);
    const counterRef = doc(database, META, COUNTER);
    const [existing, counter] = await Promise.all([tx.get(guestRef), tx.get(counterRef)]);
    // A retry after a timed-out attempt that did land keeps its number and writes what the form says
    // now, so a change made before Try again isn't dropped (Phase 4 review S22). Given the first try's
    // data (`first`), it writes only what changed since, so the partner's edit to another field in
    // between stays (Phase 5 review S20). A try that a newer one has replaced (`superseded`) writes
    // nothing over a guest that landed: a late first try would put its old form back over Try
    // again's (Phase 6 review S10).
    if (existing.exists()) {
      if (opts.superseded?.()) return { id, number: existing.data().number as number };
      const first = opts.first;
      const changed = first ? Object.fromEntries(Object.entries(data).filter(([k, v]) => !sameValue(v, first[k]))) : data;
      if (Object.keys(changed).length > 0) tx.update(guestRef, { ...changed, ...stamp(database) });
      return { id, number: existing.data().number as number };
    }
    const next = typeof counter.data()?.next === "number" ? (counter.data()!.next as number) : 1;
    tx.set(counterRef, { next: next + 1, ...stamp(database) }, { merge: true });
    tx.set(guestRef, { ...data, number: next, ...stamp(database, true) });
    return { id, number: next };
  }, opts);
}
