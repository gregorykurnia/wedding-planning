/** The words of an item row (guide §4.28), ported from the prototype's items.html. */

/** The first choice in the "who it's for" menu (N12): ticking it clears everyone else. */
export const GENERAL_CHOICE = "General, no one in particular";

/** The label of the closed "who it's for" menu: "Who Wedding cake is for: Groom's father, Groom's mother". */
export const whoLabel = (name: string, people: string) => `Who ${name} is for: ${people}`;

export const VENDOR_PLACEHOLDER = "Vendor not known yet";

export const handleLabel = (name: string) => `Move ${name}. Use Alt with the up and down arrows.`;

/** Said after a move, for a screen reader: "Wedding cake moved to 3 of 40". */
export const movedAnnouncement = (name: string, place: number, total: number) => `${name} moved to ${place} of ${total}`;

/** The line under a failed field. `typed` is what was typed and is kept. */
export const itemFailed = (typed: string) => (typed ? `Couldn’t save “${typed}”. What you typed is kept.` : "Couldn’t save this change. What you typed is kept.");

/** The line under a row whose one-tap change (an event, who it's for, the star or the tick) didn't save; the choice stays shown. */
export const itemChoiceFailed = (name: string) => `Couldn’t save the change to ${name}. Your choice is kept.`;

/** What part of an item row a change that didn't save was in. */
export type ItemField = "name" | "vendor" | "events" | "person" | "next" | "confirmed";

export type ItemMenuAction = "below" | "several" | "up" | "down" | "remove";

/** The ⋯ menu: moving is only for our own order, so a sort or a filter takes Move up and Move down away. */
export function menuEntries(reorderable: boolean): { action: ItemMenuAction; label: string; danger?: boolean }[] {
  return [
    { action: "below", label: "Add an item below" },
    { action: "several", label: "Add several below" },
    ...(reorderable
      ? ([
          { action: "up", label: "Move up" },
          { action: "down", label: "Move down" },
        ] as const)
      : []),
    { action: "remove", label: "Remove", danger: true },
  ];
}
