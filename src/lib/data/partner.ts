"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActivitySince } from "@/lib/collections/activity";
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
  const [since] = useState(() => Date.now());
  const { data } = useActivitySince(since);
  const seen = useRef(new Set<string>());
  const latest = useRef(onNews);

  useEffect(() => {
    latest.current = onNews;
  });

  useEffect(() => {
    // Wait for the name, so the first toast isn't "Your partner".
    if (!ready || !user) return;
    for (const entry of data) {
      if (seen.current.has(entry.id)) continue;
      seen.current.add(entry.id);
      if (!entry.by || isRemoval(entry.kind)) continue;
      const today = localIso(new Date());
      if (entry.by === user.uid) {
        // This account on another device, never this one (entries from before
        // the device was kept, and every one made here, are not news).
        if (!entry.device || entry.device === deviceId()) continue;
        latest.current({
          id: entry.id,
          name: myName || "You",
          own: true,
          text: ownToast(entry.kind, entry.params, today, entry.deviceKind ?? "phone"),
          flash: flashTargets(entry.target),
        });
        continue;
      }
      latest.current({
        id: entry.id,
        name,
        own: false,
        text: partnerToast(name, entry.kind, entry.params, today),
        flash: flashTargets(entry.target),
      });
    }
  }, [data, ready, user, name, myName]);
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
  const [since] = useState(() => Date.now());
  const { data } = useActivitySince(since);
  const { kind, id } = record;
  const mine = user?.uid;

  return useMemo(() => {
    const hit = data.find((e) => e.by && e.by !== mine && removes(e, { kind, id }));
    return hit ? { by: name } : null;
  }, [data, mine, name, kind, id]);
}
