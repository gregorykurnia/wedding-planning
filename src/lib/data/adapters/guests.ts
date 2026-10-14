import type { GuestRecord } from "@/lib/model/guests";
import type { GuestEvent, Rsvp } from "@/lib/model/labels";
import { millis, num, numOrNull, str, strOrNull } from "./common";

const RSVPS: readonly Rsvp[] = ["pending", "yes", "no"];
const EVENTS: readonly GuestEvent[] = ["Both", "Matrimony", "Reception", "Reception Shortlist", "Unsure (Abroad)"];

export interface GuestDoc extends GuestRecord {
  number: number;
  /** False when the number is only this list's creation order (not yet migrated). */
  numberStored: boolean;
  createdAt: number | null;
  updatedAt: number | null;
  updatedBy: string | null;
}

type Unnumbered = Omit<GuestDoc, "number" | "numberStored"> & { stored: number | null };

export function guestFromDoc(id: string, data: Record<string, unknown>): Unnumbered {
  const stored = numOrNull(data.number);
  return {
    id,
    name: str(data.name),
    connection: str(data.connection),
    country: str(data.country),
    allergies: str(data.allergies),
    rsvpStatus: RSVPS.includes(data.rsvpStatus as Rsvp) ? (data.rsvpStatus as Rsvp) : "pending",
    eventType: EVENTS.includes(data.eventType as GuestEvent) ? (data.eventType as GuestEvent) : "Both",
    inviteSent: data.inviteSent === true,
    plusOnes: num(data.plusOnes),
    stored: stored !== null && stored > 0 ? Math.trunc(stored) : null,
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
    updatedBy: strOrNull(data.updatedBy),
  };
}

/**
 * Every guest gets a number: the stored one, or, for guests from before
 * numbering, the next numbers after the highest stored one in creation order
 * (what migration 1.11 will store). Records still being created (no
 * `createdAt` yet) come last.
 */
export function numberGuests(guests: readonly Unnumbered[]): GuestDoc[] {
  let next = guests.reduce((max, g) => Math.max(max, g.stored ?? 0), 0) + 1;
  const provisional = new Map<string, number>();
  [...guests]
    .filter((g) => g.stored === null)
    .sort((a, b) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity) || a.id.localeCompare(b.id))
    .forEach((g) => provisional.set(g.id, next++));
  return guests.map(({ stored, ...g }) => ({
    ...g,
    number: stored ?? provisional.get(g.id)!,
    numberStored: stored !== null,
  }));
}
