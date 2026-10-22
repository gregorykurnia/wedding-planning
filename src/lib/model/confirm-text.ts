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
  /** Whether trying again could work; when it can't, the action isn't offered again. */
  retry: boolean;
}

/** "Delete for good" and "Empty …" are deletions; every other action is a removal. */
const DELETES = /^(delete|empty)\b/i;

/**
 * `code` is the write's `WriteError` code (src/lib/data/write-error.ts). The
 * guide words only the database being out of reach; demonstration mode, a
 * refused account, a thing already gone and one that changed while it was
 * being removed (a folder something just landed in) are provisional (G38/N38).
 */
export function confirmFailure(action: string, code?: string): ConfirmFailure {
  const deletes = DELETES.test(action);
  const lead = deletes ? "Nothing was deleted." : "Nothing was removed.";
  switch (code) {
    case "demo":
      return {
        lead,
        reason: "This is demonstration mode, so nothing can be changed and everything is just as it was.",
        retry: false,
      };
    case "denied":
      return {
        lead,
        reason:
          "The planner didn’t accept this account just now, so everything is just as it was. Sign in again, then try again.",
        retry: false,
      };
    case "missing":
      return {
        lead,
        reason: `It isn’t there any more: it was ${deletes ? "deleted" : "removed"} already, perhaps on another device.`,
        retry: false,
      };
    case "changed":
      return {
        lead,
        reason: "Something changed in it just now, perhaps on another device, so it was kept as it is.",
        retry: false,
      };
    default:
      return {
        lead,
        reason:
          "The planner couldn’t reach its database, so everything is just as it was. Try again, or keep it for now.",
        retry: true,
      };
  }
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

/**
 * The same when the later change was your own (this device or your other one),
 * so the partner isn't named for it. Provisional (G35/N35): the guide words
 * only the partner's case.
 */
export const UNDO_CONFLICT_OWN = "Can’t undo: you’ve changed this since. It’s kept as it is now.";

/**
 * The toast when Undo finds the thing gone since, or the place it would go
 * back to (P5-S9), so nothing is taken back and Undo isn't offered again.
 * Provisional (G39/N39): the guide words no such case.
 */
export const UNDO_GONE = "Can’t undo: it isn’t there any more. Nothing was changed.";
