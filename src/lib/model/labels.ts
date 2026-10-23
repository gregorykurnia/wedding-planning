/**
 * Stored value ↔ label maps (implementation plan §2.7).
 *
 * The new UI shows the design's words but writes the stored values, so the old
 * UI keeps working on the same documents. Every list is in the order the design
 * shows it. A value the map doesn't know (written by hand, or by a later
 * version) is shown as it is.
 */

export interface Choice<V extends string = string> {
  value: V;
  label: string;
}

const choices = <V extends string>(pairs: readonly (readonly [V, string])[]): Choice<V>[] =>
  pairs.map(([value, label]) => ({ value, label }));

/** The label for a stored value, or the value itself when it isn't in the list. */
export const labelOf = (list: readonly Choice[], value: string | null | undefined) =>
  value == null ? "" : (list.find((c) => c.value === value)?.label ?? value);

/** Position in the list, or -1 when the value isn't in it. */
export const indexOf = (list: readonly Choice[], value: string | null | undefined) =>
  list.findIndex((c) => c.value === value);

export type VendorStage = "List" | "Inquiring" | "Consideration" | "Chosen" | "Done" | "Rejected";

/** The five steps of the stage thread, in order. */
export const VENDOR_STAGES = choices<VendorStage>([
  ["List", "Noted"],
  ["Inquiring", "Inquiring"],
  ["Consideration", "Considering"],
  ["Chosen", "Chosen"],
  ["Done", "Done"],
]);
export const VENDOR_RULED_OUT: VendorStage = "Rejected";
export const vendorStageLabel = (stage: string) => (stage === VENDOR_RULED_OUT ? "Ruled out" : labelOf(VENDOR_STAGES, stage));

export type VenueStage = "Shortlist" | "Contacted" | "Toured" | "Booked" | "Rejected";

export const VENUE_STAGES = choices<VenueStage>([
  ["Shortlist", "Noted"],
  ["Contacted", "Contacted"],
  ["Toured", "Visited"],
  ["Booked", "Booked"],
]);
export const VENUE_RULED_OUT: VenueStage = "Rejected";
export const venueStageLabel = (stage: string) => (stage === VENUE_RULED_OUT ? "Ruled out" : labelOf(VENUE_STAGES, stage));

export type GuestEvent = "Both" | "Matrimony" | "Reception" | "Reception Shortlist" | "Unsure (Abroad)";

/** "Invited to" (G2). */
export const GUEST_EVENTS = choices<GuestEvent>([
  ["Both", "Both events"],
  ["Matrimony", "Ceremony only"],
  ["Reception", "Reception only"],
  ["Reception Shortlist", "Reception if space allows"],
  ["Unsure (Abroad)", "Unsure, living abroad"],
]);

export type Rsvp = "pending" | "yes" | "no";

export const RSVPS = choices<Rsvp>([
  ["pending", "Waiting"],
  ["yes", "Attending"],
  ["no", "Not attending"],
]);

export type ItemEvent = "Reception" | "Matrimony" | "Sangjit" | "Pre-Wedding";

export const ITEM_EVENTS = choices<ItemEvent>([
  ["Reception", "Reception"],
  ["Matrimony", "Holy matrimony"],
  ["Sangjit", "Sangjit"],
  ["Pre-Wedding", "Pre-wedding"],
]);

export type ItemPerson =
  | "General"
  | "Groom"
  | "Bride"
  | "Groom Dad"
  | "Groom Mom"
  | "Groom Brother"
  | "Groom Sister"
  | "Bride Dad"
  | "Bride Mom"
  | "Bride Brothers";

export const ITEM_PEOPLE = choices<ItemPerson>([
  ["General", "General"],
  ["Groom", "Groom"],
  ["Bride", "Bride"],
  ["Groom Dad", "Groom's father"],
  ["Groom Mom", "Groom's mother"],
  ["Groom Brother", "Groom's brother"],
  ["Groom Sister", "Groom's sister"],
  ["Bride Dad", "Bride's father"],
  ["Bride Mom", "Bride's mother"],
  ["Bride Brothers", "Bride's brothers"],
]);

export type ScheduleKind = "key_date" | "vendor_call" | "organiser_call" | "appointment" | "payment" | "deadline" | "other";

/** "organiser_call" and "key_date" (a milestone such as the sangjit or the pre-wedding shoot) are new. */
export const SCHEDULE_KINDS = choices<ScheduleKind>([
  ["key_date", "Key date"],
  ["vendor_call", "Vendor call"],
  ["organiser_call", "Organiser call"],
  ["appointment", "Appointment"],
  ["payment", "Payment"],
  ["deadline", "Deadline"],
  ["other", "Other"],
]);

/** Minutes before the start; `null` is no reminder. 0 and 10080 are new values (§2.7). */
export const REMINDER_CHOICES: { minutes: number | null; label: string }[] = [
  { minutes: null, label: "No reminder" },
  { minutes: 0, label: "When it starts" },
  { minutes: 15, label: "15 minutes before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 1440, label: "1 day before" },
  { minutes: 10080, label: "1 week before" },
];

/** A stored `reminderMinutes` array shows as one choice: the first minutes value, or none. */
export const reminderChoice = (minutes: readonly number[] | null | undefined): number | null => minutes?.[0] ?? null;

export function reminderLabel(minutes: readonly number[] | null | undefined): string {
  const first = reminderChoice(minutes);
  return REMINDER_CHOICES.find((c) => c.minutes === first)?.label ?? `${first} minutes before`;
}
