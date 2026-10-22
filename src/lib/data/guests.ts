"use client";

import { useMemo } from "react";
import { createNumberedGuest } from "@/lib/collections/guest-meta";
import { guestFromDoc } from "@/lib/collections/guests";
import { nextGuestNumber, type GuestRecord } from "@/lib/model/guests";
import type { GuestEvent, Rsvp } from "@/lib/model/labels";
import { useCollection } from "@/lib/use-collection";
import { logActivity } from "./activity";
import { readOf } from "./read";
import { useSession } from "./session";
import type { Loaded } from "./settings";
import { removeWithUndo, updateWithUndo, type Undoable } from "./undo";
import { newId, update, type WriteOptions } from "./write";

const COLLECTION = "guests";

/** The guests' screen read (guide §5.23): every guest, live, and the number the next one will get. */
export interface GuestBook {
  guests: GuestRecord[];
  /** "Will be guest number 21": past the highest number in use and the counter. */
  nextNumber: number;
}

/**
 * Every guest and the counter that issues numbers (G6), live, so the partner's
 * RSVP arrives in place. No ordering is asked of the database: a guest with no
 * `createdAt` must not drop out of the list. Demonstration mode has none.
 */
export function useGuests(): Loaded<GuestBook> {
  const { connection } = useSession();
  const list = useCollection<GuestRecord>(COLLECTION, guestFromDoc, []);
  const meta = useCollection<{ id: string; next: number }>(
    "guestMeta",
    (id, data) => ({ id, next: typeof data.next === "number" ? data.next : 1 }),
    [],
  );
  const book = useMemo<GuestBook>(() => {
    // The counter holds the number the next guest gets; the screen needs the last one issued to compare.
    const counter = (meta.data.find((m) => m.id === "counter")?.next ?? 1) - 1;
    return { guests: list.data, nextNumber: nextGuestNumber(list.data, counter) };
  }, [list.data, meta.data]);
  return readOf(connection, [list, meta], book);
}

/** The id for a new guest, made once so Try again never adds them twice. */
export const newGuestId = (opts: WriteOptions = {}): string => newId(COLLECTION, opts);

/** What the add sheet collects. */
export interface NewGuest {
  /** Made when the sheet's form began, so Try again writes the same record. */
  id: string;
  name: string;
  connection: string;
  country: string;
  eventType: GuestEvent;
  inviteSent: boolean;
  rsvpStatus: Rsvp;
  plusOnes: number;
  allergies: string;
}

function storedGuest(guest: NewGuest) {
  const { id, ...fields } = guest;
  void id;
  return { ...fields, name: fields.name.trim() };
}

/**
 * Adds a guest and issues their number in one transaction (G6): two people adding at once never
 * share a number, a removed guest's number isn't reused, and Try again after a timed-out attempt
 * that did land keeps what was written. Try again passes the first try (`first`), so only what was
 * changed in the form since is written over a guest that landed (Phase 5 review S20).
 */
export function addGuest(guest: NewGuest, opts: WriteOptions & { first?: NewGuest } = {}): Promise<{ id: string; number: number }> {
  const { first, ...rest } = opts;
  return createNumberedGuest(storedGuest(guest), { ...rest, id: guest.id, ...(first ? { first: storedGuest(first) } : {}) });
}

/** The fields the guest sheet saves as you go (guide §5.23). */
export interface GuestFields {
  name: string;
  connection: string;
  country: string;
  eventType: GuestEvent;
  inviteSent: boolean;
  plusOnes: number;
  allergies: string;
}

/** Saves one field of a guest. */
export function setGuestField<K extends keyof GuestFields>(id: string, field: K, value: GuestFields[K], opts: WriteOptions = {}): Promise<void> {
  return update(COLLECTION, id, { [field]: value }, opts);
}

/**
 * Records a reply (the row's switch, or the sheet's), with an undo that puts the earlier reply back
 * unless the partner has changed the guest since (N13). The partner is told ("Bella marked 王小明 as
 * attending"); a failure to tell never fails the reply.
 */
export async function setGuestRsvp(guest: Pick<GuestRecord, "id" | "name">, rsvp: Rsvp, opts: WriteOptions = {}): Promise<Undoable> {
  const done = await updateWithUndo(COLLECTION, guest.id, { rsvpStatus: rsvp }, opts);
  void logActivity("guest.replied", { name: guest.name, reply: rsvp }, { kind: "guest", id: guest.id }, opts);
  return { undo: done.undo };
}

/** Removes a guest, with an undo that puts them back with the same number (their number is never reused). */
export function removeGuest(id: string, opts: WriteOptions = {}): Promise<Undoable> {
  return removeWithUndo(COLLECTION, id, opts);
}
