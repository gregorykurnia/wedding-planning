/**
 * The couple's two accounts. While access is open (2026-10-22) only the push
 * sender's address reads this. Before, it was the list of accounts that may
 * use the app, kept the same as `firestore.rules`: route handlers use the
 * Admin SDK, which skips the rules, so they checked it themselves (plan §2.9).
 */
export const ALLOWED_EMAILS: readonly string[] = ["gregory.kurnia@gmail.com", "bellabarliana15@gmail.com"];
