/**
 * What the sign-in screen says (guide §5.1) and how Firebase's error codes map
 * to it. Pure: the screen holds the state and does the sign-in.
 */

export const GATE_TITLE = "Our wedding planner";
export const GATE_SUB = "For the two of us only. Sign in to see everything.";

/** Why a sign-in attempt didn't end with the visitor in. */
export type SignInProblemKind =
  | "wrong"
  | "offline"
  | "google-closed"
  | "google-blocked"
  | "google-failed"
  | "other";

/** Rose says something went wrong and needs the visitor; calm says what the planner is doing. */
export type ProblemTone = "rose" | "calm";

export interface ProblemLine {
  tone: ProblemTone;
  text: string;
}

export const PROBLEM_LINES: Record<SignInProblemKind, ProblemLine> = {
  wrong: {
    tone: "rose",
    text: "That email and password don’t match. Check them and try again, or continue with Google.",
  },
  offline: {
    tone: "calm",
    text: "You’re offline. Signing in needs a connection; try again once this device is back online.",
  },
  "google-closed": {
    tone: "calm",
    text: "The Google window closed before signing in finished, so you’re not signed in yet. Continue with Google to try again.",
  },
  "google-blocked": {
    tone: "rose",
    text: "Your browser blocked the Google window. Allow pop-ups for the planner in the browser’s address bar, then continue with Google again. Or sign in with your email below.",
  },
  "google-failed": {
    tone: "rose",
    text: "Google couldn’t finish signing you in. Nothing was changed. Try again in a moment, or sign in with your email below.",
  },
  // Not in the guide (G19/N19): too many tries, a disabled account, anything unexpected.
  other: {
    tone: "rose",
    text: "Couldn’t sign you in. Nothing was changed. Try again in a moment, or continue with Google.",
  },
};

export const SIGNED_OUT_LINE: ProblemLine = {
  tone: "calm",
  text: "You’ve signed out. Nothing is shown on this device until one of you signs in again.",
};

/** The sentence after the account's address; the screen sets the address itself in bold. */
export const NOT_ALLOWED_BEFORE = "You’re signed in as ";
export const NOT_ALLOWED_AFTER =
  ", which isn’t one of the two accounts that can open this planner. Sign in with Greg’s or Bella’s account instead.";

export const DEMO_LINE =
  "The planner isn’t connected to its database yet. You can look around in demonstration mode: there’s no data and nothing is saved.";

export const WAITING_NOTE =
  "Finish signing in in the Google window. If you can’t see it, it may be behind this one.";

function failureCode(err: unknown): string | undefined {
  return typeof err === "object" && err && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

/** A sign-in with an email and password that Firebase turned away. */
export function emailProblem(err: unknown): SignInProblemKind {
  switch (failureCode(err)) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
    case "auth/missing-password":
    case "auth/missing-email":
      return "wrong";
    case "auth/network-request-failed":
      return "offline";
    default:
      return "other";
  }
}

/** A sign-in through the Google window that didn't finish. */
export function googleProblem(err: unknown): SignInProblemKind {
  switch (failureCode(err)) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
    case "auth/user-cancelled":
      return "google-closed";
    case "auth/popup-blocked":
      return "google-blocked";
    case "auth/network-request-failed":
      return "offline";
    default:
      return "google-failed";
  }
}
