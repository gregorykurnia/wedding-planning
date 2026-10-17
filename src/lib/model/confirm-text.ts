/**
 * The words for the two ways a removal or an undo can fail to land (guide
 * §4.15, §4.16, §4.17 and §6.2). Pure, so the confirm and the toast host share
 * them and the tests read them without a screen.
 */

/** Guide §4.15 (N14): after a removal that couldn't finish, the rose box in the confirm. */
export interface ConfirmFailure {
  /** Said first, in bold: "Nothing was removed." */
  lead: string;
  /** Why, and what to do: nothing changed, so Try again or Keep it. */
  reason: string;
}

/** "Delete for good" and "Empty …" are deletions; every other action is a removal. */
const DELETES = /^(delete|empty)\b/i;

export function confirmFailure(action: string): ConfirmFailure {
  return {
    lead: DELETES.test(action) ? "Nothing was deleted." : "Nothing was removed.",
    reason:
      "The planner couldn’t reach its database, so everything is just as it was. Try again, or keep it for now.",
  };
}

/** What a confirm's button says once its write has failed: it asks again. */
export const TRY_AGAIN = "Try again";

/**
 * Guide §4.16 (N13): the toast when Undo finds the same thing changed since,
 * so nothing is taken back. A screen that knows what changed passes its own
 * sentence ("Can’t undo the split: Bella recorded Rp 5.000.000 on the balance
 * since. Both parts stay as they are now."); this is the line for any other.
 */
export function undoConflict(partner: string): string {
  return `Can’t undo: ${partner} has changed this since. It’s kept as it is now.`;
}
