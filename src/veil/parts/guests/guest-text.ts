import { cut } from "@/lib/model/format";
import { GUEST_EVENTS, RSVPS, labelOf, type Rsvp } from "@/lib/model/labels";
import type { GuestRecord } from "@/lib/model/guests";

/**
 * The words of a guest row (guide §4.29), ported from the prototype's
 * guests.html. Pure, so the component only draws.
 */

/** "Both events", or "Both events, invitation not sent". */
export const inviteLine = (g: Pick<GuestRecord, "eventType" | "inviteSent">) =>
  labelOf(GUEST_EVENTS, g.eventType) + (g.inviteSent ? "" : ", invitation not sent");

/** The line under a guest's name: connection, country and food notes (the start of them), or nothing. */
export function metaParts(g: { connection: string; country: string; allergies: string }) {
  return {
    plain: [g.connection.trim(), g.country.trim()].filter(Boolean),
    food: cut(g.allergies.trim(), 90),
  };
}

/** The toast after one tap: "王小明: attending". */
export const rsvpToast = (name: string, rsvp: Rsvp) => `${name}: ${labelOf(RSVPS, rsvp).toLowerCase()}`;

/** "+2" after a name; nothing for none. */
export const plusText = (plusOnes: number) => (plusOnes > 0 ? `+${plusOnes}` : "");

export const rsvpFailed = (name: string) => `Couldn’t save the reply for ${name}. Your choice is kept.`;
