/**
 * Who's who (guide §5.1, §6.3, N3): which of the two names belongs to which
 * account, so news of a change names the person whose account made it, and a
 * change from your own other device is never reported as your partner's.
 *
 * The two names live in the settings as `yourName` (the first) and
 * `partnerName` (the second). Each account holds one of those two places, and
 * the pairing belongs to the account, not the spelling, so renaming "Greg" to
 * "Gregory" keeps it. Pure, so the rules are tested without a browser.
 */

export type Slot = "first" | "second";

/** The pairing: an account's uid to the place it holds. Stored in `settings/wedding`. */
export type AccountSlots = Record<string, Slot>;

export interface WhoSettings {
  yourName: string;
  partnerName: string;
  /** From before accounts were paired: the second name's email. Still read, never written. */
  partnerEmail: string;
  accountSlots?: AccountSlots;
}

export const otherSlot = (slot: Slot): Slot => (slot === "first" ? "second" : "first");

/** What the partner is called until a name is set. */
export const PARTNER_FALLBACK = "Your partner";

export const nameOfSlot = (settings: WhoSettings, slot: Slot): string =>
  (slot === "first" ? settings.yourName : settings.partnerName).trim();

const isSlot = (value: unknown): value is Slot => value === "first" || value === "second";

/** Reads the stored pairing, ignoring anything that isn't a place. */
export function readSlots(raw: unknown): AccountSlots {
  if (typeof raw !== "object" || raw === null) return {};
  const slots: AccountSlots = {};
  for (const [uid, slot] of Object.entries(raw)) if (isSlot(slot)) slots[uid] = slot;
  return slots;
}

/**
 * Which place an account holds, or null while nobody knows. In order: the
 * account's own entry; the place the other account doesn't hold ("once one
 * account has a name, the other account gets the other name without asking");
 * and, for settings from before pairing, the second name's email.
 */
export function slotOf(settings: WhoSettings, uid: string, email: string): Slot | null {
  const slots = settings.accountSlots ?? {};
  const own = slots[uid];
  if (own) return own;
  const others = new Set(Object.entries(slots).filter(([id]) => id !== uid).map(([, slot]) => slot));
  if (others.size === 1) return otherSlot([...others][0]);
  if (others.size > 1) return null;
  const partnerEmail = settings.partnerEmail.trim().toLowerCase();
  if (!partnerEmail) return null;
  return email.trim().toLowerCase() === partnerEmail ? "second" : "first";
}

/**
 * The name of the person whose account made a change, from the signed-in
 * account's point of view. An account the pairing doesn't list is the other
 * of the two from this one.
 */
export function nameOfAccount(settings: WhoSettings, byUid: string, myUid: string, myEmail: string): string {
  const mine = slotOf(settings, myUid, myEmail);
  const slot = settings.accountSlots?.[byUid] ?? (byUid === myUid ? mine : mine ? otherSlot(mine) : null);
  return (slot && nameOfSlot(settings, slot)) || (byUid === myUid ? "" : PARTNER_FALLBACK);
}

/** The signed-in account's own name ("" while unknown), and the partner's. */
export function whoIs(settings: WhoSettings, uid: string, email: string) {
  const mine = slotOf(settings, uid, email);
  return {
    mine,
    myName: mine ? nameOfSlot(settings, mine) : "",
    partnerName: (mine && nameOfSlot(settings, otherSlot(mine))) || PARTNER_FALLBACK,
  };
}

/**
 * What the first sign-in asks (guide §5.1): nothing once the account has a
 * place; "Which of you is this?" when both names are set; and the two name
 * fields when they aren't yet.
 */
export type WhoAsk = "none" | "choose" | "names";

export function whoAsk(settings: WhoSettings, uid: string, email: string): WhoAsk {
  if (slotOf(settings, uid, email)) return "none";
  return settings.yourName.trim() && settings.partnerName.trim() ? "choose" : "names";
}

/**
 * The pairing after Swap them: this account takes the other place, and so
 * does the other account, if it has signed in (`partnerUid`). Written as the
 * whole map, so each place is held by exactly one account.
 */
export function swappedSlots(settings: WhoSettings, uid: string, email: string, partnerUid: string | null): AccountSlots | null {
  const mine = slotOf(settings, uid, email);
  if (!mine) return null;
  const slots: AccountSlots = { [uid]: otherSlot(mine) };
  if (partnerUid && partnerUid !== uid) slots[partnerUid] = mine;
  return slots;
}

export const WELCOME_TITLE = "Welcome";
export const WHO_QUESTION = "Which of you is this?";
export const WHO_WHY = "So the planner can say who changed what. You can change this later in Wedding settings.";
export const MY_NAME_LABEL = "Your first name";
export const THEIR_NAME_LABEL = "Your partner’s first name";
export const WHO_NAMES_FAILED = "That wasn’t saved. What you typed is still here.";
export const WHO_PICK_FAILED = "That wasn’t saved. Try again.";

/** "Continue as Bella", or just "Continue" before a name is chosen. */
export const continueAs = (name: string | null) => (name ? `Continue as ${name}` : "Continue");

/** Settings (4.25), under the two accounts. */
export const SWAP_NOTE =
  "Each name belongs to one account, so the planner can say which of you changed something. Changes you make on your other phone show as yours. Names the wrong way round?";
export const SWAP_LINK = "Swap them";
export const swapToast = (myName: string) => `Swapped: this account is now ${myName || "the other name"}`;
