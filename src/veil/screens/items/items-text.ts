import { n0, plural } from "@/lib/model/format";
import type { ItemCounts } from "@/lib/model/items";
import { showingOfText } from "@/veil/parts/tools/tools-text";

/** The words of the Wedding items screen and its add sheet (guide §5.22, §6.1, §6.8), pure so the tests read them. */

export const ITEMS_SUB = "Every piece of the day, and who provides it";

/** The line under the figure: "6 marked to work on next". */
export const nextLine = (marked: number) => (marked ? `${n0(marked)} marked to work on next` : "Nothing marked to work on next");

/** The thread's two ends and its words for a screen reader. */
export function itemsThread(counts: ItemCounts): { ends: [string, string]; label: string } {
  return {
    ends: [`${counts.percent}% confirmed`, `${n0(counts.toGo)} to go`],
    label: `${counts.percent}% confirmed, ${n0(counts.toGo)} to go`,
  };
}

export const SEARCH_LABEL = "Search items, vendors and people";
export const SEARCH_PLACEHOLDER = "Search items, vendors and people";

export const CONFIRMED_CHOICES = [
  { value: "", label: "Confirmed or not" },
  { value: "yes", label: "Confirmed" },
  { value: "no", label: "Not confirmed yet" },
] as const;

export const EVENTS_LABEL = "Events";
export const ANYONE = "Anyone";

/** The Category filter's first choice: every category. */
export const ANY_CATEGORY = "Any";

export const PEOPLE_FILTER_LABEL = "People";
export const NEXT_ONLY = "Work on next only";

/**
 * The count line over the list (guide §6.8): "12 items of 2.004" while a search or
 * filter is on, "Showing 150 of 2.004" when a long list is paged, and nothing when
 * every item is shown.
 */
export function countLine(matched: number, shown: number, total: number, filtering: boolean): string | null {
  const paged = shown < matched;
  if (filtering) return `${plural(matched, "item")} of ${n0(total)}${paged ? `, showing ${n0(shown)}` : ""}`;
  return paged ? showingOfText(shown, matched) : null;
}

export const NOTHING_TRACKED = {
  title: "Nothing tracked yet",
  body: "List every piece the wedding needs, from the venue to the bride’s mother’s makeup, and who provides it.",
};
export const START_COMMON = "Start with common items";
export const ADD_ITEMS = "Add items";
export const DEMO_ADDING = "Demonstration mode: adding is turned off.";

/** The note over the list the first time it opens already filled in (T10). */
export const startedWith = (count: number) => `The tracker starts with ${plural(count, "common item")}. Rename, fill in or remove any of them.`;

export const NO_MATCH_BODY =
  "Search looks at item and vendor names and who each item is for. Narrowing by events or people shows items with any of the ones you pick, so an item for both mothers shows for either.";
export const noMatchTitle = (query: string) => (query.trim() ? `Nothing matches “${query.trim()}”` : "No items fit");
export const SHOW_EVERYTHING = "Show everything";

export const addedCommonToast = (count: number) => `Added ${plural(count, "common item")}`;

// ---------- remove ----------

export const removeConfirm = (name: string) => ({
  title: `Remove ${name.trim() || "this item"}?`,
  body: "You can undo for a few seconds, and it goes back exactly where it was.",
  action: "Remove item",
});
export const removedToast = (name: string) => `Removed ${name.trim() || "the item"}`;

// ---------- the add sheet ----------

export const ADD_SHEET_LINES = "Items, one per line";
export const ADD_SHEET_PLACEHOLDER = "Bride’s mother’s makeup\nGroom’s father’s suit\nRing bearer’s pillow";
export const addSheetSub = (after: string | null) =>
  `${after === null ? "At the end of the list" : `Below “${after.trim() || "this item"}”`}. One item per line.`;
export const addedToast = (count: number) => `Added ${plural(count, "item")}`;

// ---------- changes that didn't land (provisional: G31/N31) ----------

export const ADD_FAILED = "The items weren’t added. What you typed is still here.";
export const addBelowFailed = (name: string) => `Couldn’t add an item below “${name.trim() || "this item"}”. Nothing was changed.`;
export const moveFailed = (name: string) => `Couldn’t move “${name.trim() || "this item"}”. Nothing was changed.`;
export const COMMON_FAILED = "Couldn’t add the common items. Nothing was changed.";
