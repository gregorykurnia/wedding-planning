/**
 * The words for the keen heart (guide §4.22). The label stays the same when the
 * heart is pressed; `aria-pressed` says whether it's on. The screen shows the
 * toast after a change, since the screen makes the write.
 */

/** The accessible name: "Keen on Kebun Bunga Atelier". */
export const keenLabel = (name: string): string => `Keen on ${name}`;

/** The toast after a change: "Marked Kebun Bunga Atelier as one you’re keen on", or "Unmarked …". */
export const keenToast = (name: string, keen: boolean): string =>
  keen ? `Marked ${name} as one you’re keen on` : `Unmarked ${name}`;

/** Under a row whose change didn't save (guide §6.1). The row keeps the choice; "Try again" follows it. */
export const keenFailed = (name: string): string => `Couldn’t save the change to ${name}. Your choice is kept.`;
