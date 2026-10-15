import type { ItemRecord } from "@/lib/model/items";
import { ITEM_PEOPLE, type ItemPerson } from "@/lib/model/labels";

/** The words of an item row (guide §4.28), ported from the prototype's items.html. */

/** The person an item is for. Items made before there was one choice may list several (G12); the first one shows. */
export const personOf = (item: Pick<ItemRecord, "persons">): ItemPerson => item.persons[0] ?? ITEM_PEOPLE[0].value;

export const PERSON_OPTIONS = ITEM_PEOPLE.map((p) => ({ value: p.value, label: p.label }));

export const VENDOR_PLACEHOLDER = "Vendor not known yet";

export const handleLabel = (name: string) => `Move ${name}. Use Alt with the up and down arrows.`;

/** Said after a move, for a screen reader: "Wedding cake moved to 3 of 40". */
export const movedAnnouncement = (name: string, place: number, total: number) => `${name} moved to ${place} of ${total}`;

/** The line under a failed field. `typed` is what was typed and is kept. */
export const itemFailed = (typed: string) => (typed ? `Couldn’t save “${typed}”. What you typed is kept.` : "Couldn’t save this change. What you typed is kept.");

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
