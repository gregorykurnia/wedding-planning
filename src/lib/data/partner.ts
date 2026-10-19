"use client";

import { useEffect, useRef, useState } from "react";
import { useActivityNews, type ActivityEntry } from "@/lib/collections/activity";
import { localIso } from "@/lib/model/dates";
import {
  flashTargets,
  isRemoval,
  ownToast,
  partnerToast,
  removes,
  type EntryTarget,
} from "@/lib/model/partner";
import { deviceId } from "./device";
import { useSession } from "./session";
import { useWho } from "./who";

/**
 * Live partner changes (guide §6.3). The partner's name is the name the other
 * of the two accounts holds (who's who, N3), "Your partner" until a name is set.
 */
export function usePartnerName(): { name: string; ready: boolean } {
  const { partnerName, ready } = useWho();
  return { name: partnerName, ready };
}

export interface PartnerNews {
  id: string;
  /** Whose circle the toast shows: the partner's name, or yours for a change from your other device. */
  name: string;
  /** A change you made on your other phone or computer (N3): the toast is yours, in champagne. */
  own: boolean;
  /** The sentence, or null when this kind has no toast. */
  text: string | null;
  /** What to flash: the target, plus a part's booking. */
  flash: EntryTarget[];
}

/**
 * Calls `onNews` once for each change the other account makes after this
 * mounts (the session start, when mounted by the providers), and for each
 * this account makes on another device (N3). Removals aren't news; they reach
 * the screen that is showing the record (useRemovedByPartner).
 */
export function usePartnerNews(onNews: (news: PartnerNews) => void) {
  const { user } = useSession();
  const { partnerName: name, myName, ready } = useWho();
  // New entries wait here until the names are known.
  const waiting = useRef<ActivityEntry[]>([]);
  const deliver = useRef(() => {});

  useEffect(() => {
    deliver.current = () => {
      // Wait for the name, so the first toast isn't "Your partner".
      if (!ready || !user) return;
      const entries = waiting.current;
      waiting.current = [];
      for (const entry of entries) {
        if (!entry.by || isRemoval(entry.kind)) continue;
        const today = localIso(new Date());
        if (entry.by === user.uid) {
          // This account on another device, never this one (entries from before
          // the device was kept, and every one made here, are not news).
          if (!entry.device || entry.device === deviceId()) continue;
          onNews({
            id: entry.id,
            name: myName || "You",
            own: true,
            text: ownToast(entry.kind, entry.params, today, entry.deviceKind ?? "phone"),
            flash: flashTargets(entry.target),
          });
          continue;
        }
        onNews({
          id: entry.id,
          name,
          own: false,
          text: partnerToast(name, entry.kind, entry.params, today),
          flash: flashTargets(entry.target),
        });
      }
    };
    deliver.current();
  });

  useActivityNews((entries) => {
    waiting.current.push(...entries);
    deliver.current();
  });
}

/**
 * Set when the other account removes the record being looked at, after this
 * screen opened. The data hooks (`useBooking(id)` and the rest) turn it into
 * `status: 'gone'` with `by` in the message ("Bella removed it on another
 * device a moment ago").
 */
export function useRemovedByPartner(record: EntryTarget): { by: string } | null {
  const { user } = useSession();
  const { name } = usePartnerName();
  const { kind, id } = record;
  const mine = user?.uid;
  // The record this was said about, so moving to another one forgets it.
  const [hit, setHit] = useState<string | null>(null);

  useActivityNews((entries) => {
    if (entries.some((e) => e.by && e.by !== mine && removes(e, { kind, id }))) setHit(`${kind}/${id}`);
  });

  return hit === `${kind}/${id}` ? { by: name } : null;
}
