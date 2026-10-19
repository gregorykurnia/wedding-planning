import { n0, plural } from "@/lib/model/format";
import { heads, type GuestRecord } from "@/lib/model/guests";
import { RSVPS, GUEST_EVENTS } from "@/lib/model/labels";

/** The words of the Guests screen and its two sheets (guide §5.23, §6.1, §6.2, §6.8), pure so the tests read them. */

/** The line under the title: "20 guests invited, 34 people with plus-ones", or an invitation when there are none. */
export const guestsSub = (guests: number, people: number) =>
  guests ? `${plural(guests, "guest")} invited, ${plural(people, "person", "people")} with plus-ones` : "Who’s coming to what";

export const ATTENDING_KICKER = "Attending so far";

export const NOTHING_YET = {
  title: "No guests yet",
  body: "Add each guest with how they’re connected to you, which events they’re invited to and any plus-ones. Headcounts for each event work themselves out.",
};
export const ADD_A_GUEST = "Add a guest";
export const DEMO_ADDING = "Demonstration mode: adding is turned off.";

export const SEARCH_LABEL = "Search guests";
export const SEARCH_PLACEHOLDER = "Search names, connections, countries and food notes";

export const RSVP_FILTER_OPTIONS = [{ value: "", label: "Any" }, ...RSVPS.map((r) => ({ value: r.value, label: r.label }))];
export const INVITE_FILTER_OPTIONS = [{ value: "", label: "Any event" }, ...GUEST_EVENTS.map((e) => ({ value: e.value, label: e.label }))];

export const SHOW_EVERYONE = "Show everyone";
export const noMatchTitle = (query: string) => `No guests match${query.trim() ? ` “${query.trim()}”` : ""}`;
export const NO_MATCH_BODY = "Search looks at names, connections, countries and food notes.";

/**
 * The count over the list: "20 guests", "3 guests of 20" while a search or filter is on, and "…, showing 100"
 * when a long list is paged.
 */
export function countLine(matched: number, shown: number, total: number, filtering: boolean): string {
  const head = filtering ? `${plural(matched, "guest")} of ${n0(total)}` : plural(matched, "guest");
  return shown < matched ? `${head}, showing ${n0(shown)}` : head;
}

// ---------- a reply that didn't count, and one the partner changed ----------

/** The 9-second toast when Undo of a reply finds the guest changed since (N13, provisional: G32). */
export const rsvpConflict = (partner: string, name: string) => `Can’t undo the reply: ${partner} has changed ${name} since. It’s kept as it is now.`;

// ---------- the sheets ----------

export const addSheetSub = (number: number) => `Will be guest number ${number}`;
export const editSheetSub = (number: number | null | undefined) => (number != null ? `Guest number ${number}` : null);
export const addedToast = (name: string, number: number) => `Added ${name.trim()} as guest ${number}`;

export const NAME_LABEL = "Name";
export const CONNECTION_LABEL = "How they’re connected";
export const CONNECTION_PLACEHOLDER = "For example, groom’s uncle or bride’s colleague";
export const CONNECTION_HINT = "Mention groom’s or bride’s so the two sides add up.";
export const COUNTRY_LABEL = "Country";
export const INVITED_LABEL = "Invited to";
export const INVITATION_LABEL = "Invitation";
export const INVITATION_SENT = "Sent";
export const RSVP_LABEL = "RSVP";
export const PLUS_ONES_LABEL = "Plus-ones";
export const FOOD_LABEL = "Food notes";
export const FOOD_PLACEHOLDER = "Allergies, halal, vegetarian, children’s meals";

export const ADD_GUEST = "Add guest";
export const ADD_AND_ANOTHER = "Add and start another";
export const NAME_MISSING = "Give the guest a name.";
/** Provisional (G32). */
export const ADD_FAILED = "The guest wasn’t added: the planner lost its connection. Everything you entered is still here.";

// ---------- remove ----------

export const REMOVE_ACTION = "Remove guest";
export const removeTitle = (name: string) => `Remove ${name.trim() || "this guest"}?`;
export const removeBody = (guest: Pick<GuestRecord, "name" | "plusOnes">) =>
  guest.plusOnes > 0
    ? `${guest.name.trim()} was bringing ${plural(guest.plusOnes, "plus-one")}, so the headcount drops by ${heads(guest)}. You can undo for a few seconds.`
    : "You can undo for a few seconds. Their number isn’t reused.";
export const removedToast = (name: string) => `Removed ${name.trim() || "the guest"}`;
