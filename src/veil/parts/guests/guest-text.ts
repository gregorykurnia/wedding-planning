import { cut, plural } from "@/lib/model/format";
import { GUEST_EVENTS, RSVPS, labelOf, type Rsvp } from "@/lib/model/labels";
import type { GuestRecord, Headcounts } from "@/lib/model/guests";
import type { TallyRow } from "@/veil/parts/menu-card/tally";

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

/** The headcounts card's lines (guide §5.23): "if space allows" only when someone is. */
export function headcountRows(c: Headcounts): TallyRow[] {
  return [
    { label: "Both events", count: c.both },
    { label: "Reception", count: c.reception },
    ...(c.receptionIfSpace ? [{ label: "of which, if space allows", count: c.receptionIfSpace, tone: "of-which" as const }] : []),
    { label: "Ceremony", count: c.ceremony },
    { label: "Unsure, living abroad", count: c.unsure, tone: "apart" as const },
  ];
}

/** Under the two sides, for people whose connection names neither. */
export const notCountedLine = (people: number) =>
  `${plural(people, "person", "people")} not counted: their connection doesn’t say groom’s or bride’s.`;
