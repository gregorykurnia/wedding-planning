"use client";

import { useMemo } from "react";
import { doc } from "firebase/firestore";
import { useAccountSlots } from "@/lib/collections/accounts";
import { useMembers as useMemberDocs } from "@/lib/collections/members";
import { useWeddingSettings } from "@/lib/collections/settings";
import {
  nameOfSlot,
  swappedSlots,
  whoAsk,
  whoIs,
  type AccountSlots,
  type Slot,
  type WhoAsk,
  type WhoSettings,
} from "@/lib/model/who";
import { requireDb, uidOf } from "./db";
import { useSession } from "./session";
import { patchWithUndo } from "./undo";
import { remove, set, stamp, transact, WriteError, type WriteOptions } from "./write";

/** The accounts that have signed in (`members`), for settings' accounts list and Swap them. */
export function useMembers() {
  return useMemberDocs().data;
}

const NO_SETTINGS: WhoSettings = { yourName: "", partnerName: "", partnerEmail: "" };

/**
 * Who's who for the signed-in account (guide §5.1, N3): which of the two names
 * is theirs, and what to ask on a first sign-in. `ready` is false until the
 * settings and the pairing have been read, so nothing is asked or named too early.
 */
export function useWho() {
  const { user } = useSession();
  const settings = useWeddingSettings();
  const pairing = useAccountSlots();
  const uid = user?.uid ?? "";
  const email = user?.email ?? "";
  const loading = settings.loading || pairing.loading;
  const data = settings.data;
  const slots = pairing.slots;
  return useMemo(() => {
    const known: WhoSettings = {
      yourName: data?.yourName ?? "",
      partnerName: data?.partnerName ?? "",
      partnerEmail: data?.partnerEmail ?? "",
      accountSlots: slots,
    };
    return {
      ready: !loading && !!uid,
      // Nothing is asked until the settings have arrived.
      ask: (data && uid ? whoAsk(known, uid, email) : "none") as WhoAsk,
      ...whoIs(known, uid, email),
      /** The two names as set, first and second, for "Which of you is this?". */
      names: { first: nameOfSlot(known, "first"), second: nameOfSlot(known, "second") },
      /** For `swapNames`. */
      settings: known,
    };
  }, [data, slots, loading, uid, email]);
}

function myUid(opts: WriteOptions): string {
  const uid = uidOf(requireDb(opts.db));
  if (!uid) throw new WriteError("denied", "Nobody is signed in");
  return uid;
}

/**
 * "Which of you is this?": this account takes `slot`. Written as the one
 * entry (merged into the map), so the other account's own entry is never
 * overwritten if both sign in at once.
 */
export function chooseWho(slot: Slot, opts: WriteOptions = {}): Promise<void> {
  return set("settings", "accounts", { slots: { [myUid(opts)]: slot } }, { ...opts, merge: true });
}

/**
 * First sign-in with no names yet: the two names become the settings' two
 * names (guide §5.1, O6), and this account holds the first. A retry writes
 * both again, which changes nothing the first try already wrote.
 */
export async function startNames(mine: string, theirs: string, opts: WriteOptions = {}): Promise<void> {
  const uid = myUid(opts);
  const yourName = mine.trim();
  const partnerName = theirs.trim();
  // One transaction that reads the names first: it fails offline rather than
  // waiting to land later, and it never writes over names that were already
  // set (asked by mistake, or by both of you at once). Phase 5 review B1.
  await transact(async (tx, database) => {
    const wedding = doc(database, "settings", "wedding");
    const stored = (await tx.get(wedding)).data();
    const hasNames = !!(stored?.yourName || stored?.partnerName);
    if (hasNames && (stored?.yourName !== yourName || stored?.partnerName !== partnerName)) {
      throw new WriteError("changed", "The names were already set");
    }
    if (!hasNames) tx.set(wedding, { yourName, partnerName, ...stamp(database) }, { merge: true });
    tx.set(doc(database, "settings", "accounts"), { slots: { [uid]: "first" }, ...stamp(database) }, { merge: true });
  }, opts);
}

/**
 * Settings, "Swap them" (N3): this account and the other trade names. Resolves
 * with the undo for the toast and the place this account now holds; the undo
 * refuses with `changed` if the pairing was changed again since. `settings` is
 * `useWho().settings`, `email` this account's (for settings from before
 * pairing) and `members` the accounts that have signed in, so the other one is
 * swapped too. Resolves with `null` when this account has no name yet.
 */
export async function swapNames(
  settings: WhoSettings,
  email: string,
  members: { id: string }[],
  opts: WriteOptions = {},
): Promise<{ undo: () => Promise<void>; slot: Slot } | null> {
  const uid = myUid(opts);
  const slots: AccountSlots | null = swappedSlots(
    settings,
    uid,
    email,
    members.find((m) => m.id !== uid)?.id ?? null,
  );
  if (!slots) return null;
  try {
    const out = await patchWithUndo(
      "settings",
      "accounts",
      () => ({ patch: { slots } }),
      opts,
    );
    return { undo: out.undo, slot: slots[uid] };
  } catch (err) {
    // Paired only by the old partner's email so far: there is no pairing document to change yet.
    if (!(err instanceof WriteError) || err.code !== "missing") throw err;
    await set("settings", "accounts", { slots }, opts);
    return { undo: () => remove("settings", "accounts", opts), slot: slots[uid] };
  }
}
