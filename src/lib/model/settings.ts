/**
 * Wedding settings, in words (guide §5.3; O5, O6, A3, A5, S10, N3, N11). The
 * "phone" and "computer" copy that depends on width is the screen's; what is
 * here is the same on both. Pure, so the lines are tested without a browser.
 */
import { PARTNER_FALLBACK } from "./who";

export const SETTINGS_TITLE = "Wedding settings";

export const NAMES_HEADING = "The two of you";
export const FIRST_NAME_LABEL = "First name";
export const SECOND_NAME_LABEL = "Second name";
export const WEDDING_DATE_LABEL = "Wedding date";
export const DATE_HINT = "Every countdown and date works from this.";

/** Under the second name: where the names show, with both of them once they are set. */
export function namesHint(first: string, second: string): string {
  const both = first.trim() && second.trim() ? `, like ${first.trim()} & ${second.trim()} at the top` : "";
  return `Used wherever the planner addresses you${both}.`;
}

export const ACCOUNTS_HEADING = "Who can open the planner";
export const ACCOUNTS_DEMO = "Demonstration mode: nobody is signed in. Once the planner is connected, only your two accounts can open it.";
export const ACCOUNTS_NOTE = "Only these two accounts can see or change anything. Anyone else who signs in sees nothing.";
/** The partner has never signed in, so there is no email to show. */
export const PARTNER_NOT_YET = "Hasn’t signed in yet";
/** "Swap them" didn't go through. Provisional wording (G28). */
export const SWAP_FAILED = "The names weren’t swapped: the planner lost its connection. Nothing changed. Try again.";
/** Signing out didn't go through. Provisional wording (G28). */
export const SIGN_OUT_FAILED = "Couldn’t sign out. Try again.";

/** The serif line of the signed-in account: "Greg, you", or "You" before it has a name. */
export const myAccountName = (name: string): string => (name ? `${name}, you` : "You");

/** The partner's serif line. */
export const partnerAccountName = (name: string): string => name || PARTNER_FALLBACK;

/** How an account signed in, from `members/{uid}.provider`; nothing said when it isn't known. */
export function signedInWith(provider: string): string {
  if (!provider) return "";
  return provider === "google.com" ? "signed in with Google" : "signed in with a password";
}

/** The muted line under an account's name: the email, and how it signed in when that is known. */
export function accountDetail(email: string, provider: string): string {
  const how = signedInWith(provider);
  return how ? `${email}, ${how}` : email;
}

export const REMINDERS_CHOOSE_AGAIN = "Choose again in the schedule";

/** N11: how many arranged things hold a reminder that can't arrive, and where to choose again. */
export function reminderCantArriveLine(count: number): string {
  const who = count === 1 ? "1 appointment or call has" : `${count} appointments and calls have`;
  return `${who} a reminder you set before for a time of day, which can’t arrive.`;
}

export const INSTALL_HEADING = "On your phone";
export const INSTALLED = "Installed on this phone. Open it from your home screen like any app.";
export const INSTALL_INTRO = "Add the planner to your home screen and it opens like an app, full screen and one tap away.";
export const IPHONE_STEP = "open the planner in Safari, tap Share, then Add to Home Screen.";
export const ANDROID_STEP = "open it in Chrome, tap the menu, then Install app.";

export const ALSO_HEADING = "Also";
export const DOOR_WHO_PAYS = { name: "Who pays", summary: "Add, rename or remove funders" };
// The name stays "Vendor categories" through the launch window: the specs that name it sit beside
// lines the switch commit changed, and renaming them would stop its one-commit revert (plan §9.3).
export const DOOR_CATEGORIES = { name: "Vendor categories", summary: "Add, rename or remove" };
