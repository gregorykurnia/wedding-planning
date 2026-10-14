/**
 * Guests: headcounts, the two sides and filters (guide §5.23, §4.29; G3–G5).
 *
 * Decided rules (inventory-notes §5 #7–#9): "Attending" counts people, plus-ones
 * included. Anyone not attending is left out of every event count. "Reception
 * if space allows" counts towards the reception, not the ceremony, and is also
 * shown apart. "Unsure, living abroad" is counted on its own.
 */
import { guestMatches, type GuestSearchFields } from "./search";
import type { GuestEvent, Rsvp } from "./labels";

export interface GuestRecord extends GuestSearchFields {
  id: string;
  /** Issued once and never reused; guests written before numbering have none. */
  number?: number | null;
  rsvpStatus: Rsvp;
  eventType: GuestEvent;
  inviteSent: boolean;
  plusOnes: number;
}

/** The guest and their plus-ones. A cleared or negative number of plus-ones counts as none. */
export const heads = (g: Pick<GuestRecord, "plusOnes">) => 1 + Math.max(0, Math.trunc(g.plusOnes) || 0);

const sum = (guests: readonly GuestRecord[]) => guests.reduce((s, g) => s + heads(g), 0);

export interface Headcounts {
  /** Guests invited, each counted once. */
  guests: number;
  /** People, plus-ones included, whatever they replied. */
  people: number;
  attending: number;
  waiting: number;
  /** The event counts leave out anyone not attending. */
  both: number;
  reception: number;
  /** Of the reception, those who are invited only if there's space. */
  receptionIfSpace: number;
  ceremony: number;
  unsure: number;
}

export function headcounts(guests: readonly GuestRecord[]): Headcounts {
  const going = guests.filter((g) => g.rsvpStatus !== "no");
  const of = (...events: GuestEvent[]) => sum(going.filter((g) => events.includes(g.eventType)));
  return {
    guests: guests.length,
    people: sum(guests),
    attending: sum(guests.filter((g) => g.rsvpStatus === "yes")),
    waiting: sum(guests.filter((g) => g.rsvpStatus === "pending")),
    both: of("Both"),
    reception: of("Both", "Reception", "Reception Shortlist"),
    receptionIfSpace: of("Reception Shortlist"),
    ceremony: of("Both", "Matrimony"),
    unsure: of("Unsure (Abroad)"),
  };
}

// Words that make a connection business rather than family. "Friend" and "partner"
// are not among them: friends count as family (§5 #8).
const BUSINESS = [
  "work",
  "business",
  "colleague",
  "colleagues",
  "coworker",
  "coworkers",
  "co-worker",
  "co-workers",
  "client",
  "clients",
  "customer",
  "customers",
  "boss",
  "manager",
  "office",
  "professional",
  "professionals",
  "network",
  "networking",
  "contact",
  "contacts",
  "classmate",
  "classmates",
];

const BUSINESS_WORDS = new RegExp(`\\b(${BUSINESS.map((w) => w.replace("-", "\\-")).join("|")})\\b|同事`, "i");
const GROOM = /\bgroom\b|新郎/i;
const BRIDE = /\bbride\b|新娘/i;

export type Side = "groom" | "bride";

/** The first side the connection names: "Bride's aunt, married to the groom's uncle" is the bride's. */
export function sideOf(connection: string): Side | null {
  const g = connection.search(GROOM);
  const b = connection.search(BRIDE);
  if (g < 0 && b < 0) return null;
  if (g < 0) return "bride";
  if (b < 0) return "groom";
  return g < b ? "groom" : "bride";
}

export const isBusiness = (connection: string) => BUSINESS_WORDS.test(connection);

export interface Sides {
  groomFamily: number;
  groomBusiness: number;
  brideFamily: number;
  brideBusiness: number;
  /** People whose connection names neither side. */
  notCounted: number;
}

/** Both sides, for guests invited to both events and not declined (G4). Counts people. */
export function sides(guests: readonly GuestRecord[]): Sides {
  const out: Sides = { groomFamily: 0, groomBusiness: 0, brideFamily: 0, brideBusiness: 0, notCounted: 0 };
  for (const g of guests) {
    if (g.eventType !== "Both" || g.rsvpStatus === "no") continue;
    const side = sideOf(g.connection);
    if (!side) out.notCounted += heads(g);
    else {
      const key = `${side}${isBusiness(g.connection) ? "Business" : "Family"}` as
        | "groomFamily"
        | "groomBusiness"
        | "brideFamily"
        | "brideBusiness";
      out[key] += heads(g);
    }
  }
  return out;
}

export interface GuestFilter {
  query: string;
  /** A stored RSVP, or "" for any. */
  rsvp: Rsvp | "";
  /** A stored "invited to" value, or "" for any. */
  invite: GuestEvent | "";
}

export const NO_GUEST_FILTER: GuestFilter = { query: "", rsvp: "", invite: "" };

export const isFilteringGuests = (f: GuestFilter) => !!(f.query.trim() || f.rsvp || f.invite);

export const filterGuests = <T extends GuestRecord>(guests: readonly T[], f: GuestFilter): T[] =>
  guests.filter(
    (g) => (!f.rsvp || g.rsvpStatus === f.rsvp) && (!f.invite || g.eventType === f.invite) && guestMatches(g, f.query),
  );

/**
 * "Will be guest number 21": one more than the highest number so far, or than
 * the counter when it has run further (a removed guest's number isn't reused).
 */
export const nextGuestNumber = (guests: readonly Pick<GuestRecord, "number">[], counter = 0) =>
  Math.max(counter, 0, ...guests.map((g) => g.number ?? 0)) + 1;
