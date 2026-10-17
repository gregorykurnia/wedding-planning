import { notSaved } from "./save-state";

/**
 * The words for a sheet that is asked to close before a change has saved
 * (guide §4.14, N18). Pure, so the sheet and its tests share them.
 */

/** Done, Escape or a tap outside while a change is saving: it waits, then closes. */
export const SAVING_THEN_CLOSE = "Saving, then this closes";

/** A change that didn't save: this line, then Try again, "or", and the way out. */
export const HELD_FAILED = "Your last change isn’t saved yet.";

/**
 * A change that can't be saved yet because something is missing (N9): this
 * line, then the way out. `count` is how many changes are waiting.
 */
export const heldBlocked = (count: number) => `${notSaved(count)} yet. Fix it, or`;

/** The way out of both: a link at the end of the line. */
export const CLOSE_WITHOUT_IT = "close without it";

/** The toast after closing without a change that wasn't saved. */
export const CLOSED_WITHOUT = "Closed without your last change. It wasn’t saved.";

/** A sheet that adds something, dismissed with text typed in it. */
export const STARTED_TYPING = "You’ve started typing here. Close and it’s not added, or keep going.";

/** The rose link under its actions after that. */
export const CLOSE_WITHOUT_ADDING = "Close without adding it";
