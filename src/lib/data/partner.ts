"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useActivitySince } from "@/lib/collections/activity";
import { useWeddingSettings } from "@/lib/collections/settings";
import { localIso } from "@/lib/model/dates";
import {
  flashTargets,
  isRemoval,
  partnerToast,
  removes,
  type EntryTarget,
} from "@/lib/model/partner";
import { useSession } from "./session";

/**
 * Live partner changes (guide §6.3). The partner's name comes from settings
 * until need N3 says how an account is linked to a name: the partner is the
 * other of the two names, found by this account's email against
 * `partnerEmail`. Until settings have a name, it's "Your partner".
 */
export function usePartnerName(): { name: string; ready: boolean } {
  const { user } = useSession();
  const { data, loading } = useWeddingSettings();
  const me = user?.email.trim().toLowerCase() ?? "";
  const iAmThePartner = !!me && me === data?.partnerEmail.trim().toLowerCase();
  const named = (iAmThePartner ? data?.yourName : data?.partnerName)?.trim();
  return { name: named || "Your partner", ready: !loading };
}

export interface PartnerNews {
  id: string;
  /** The partner's name, for the toast's circle. */
  name: string;
  /** The sentence, or null when this kind has no toast. */
  text: string | null;
  /** What to flash: the target, plus a part's booking. */
  flash: EntryTarget[];
}

/**
 * Calls `onNews` once for each change the other account makes after this
 * mounts (the session start, when mounted by the providers). Removals aren't
 * news; they reach the screen that is showing the record (useRemovedByPartner).
 */
export function usePartnerNews(onNews: (news: PartnerNews) => void) {
  const { user } = useSession();
  const { name, ready } = usePartnerName();
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
      if (!entry.by || entry.by === user.uid || isRemoval(entry.kind)) continue;
      latest.current({
        id: entry.id,
        name,
        text: partnerToast(name, entry.kind, entry.params, localIso(new Date())),
        flash: flashTargets(entry.target),
      });
    }
  }, [data, ready, user, name]);
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
