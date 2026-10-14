/**
 * The two accounts that may use the app, as in `firestore.rules`. Route
 * handlers use the Admin SDK, which skips the rules, so they check this
 * themselves (plan §2.9). Keep both lists the same.
 */
export const ALLOWED_EMAILS: readonly string[] = ["gregory.kurnia@gmail.com", "bellabarliana15@gmail.com"];
