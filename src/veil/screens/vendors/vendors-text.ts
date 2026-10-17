import { MAX_CATEGORY_LENGTH, type CategoryRow } from "@/lib/model/categories";
import { n0, plural } from "@/lib/model/format";
import { hereText, pagedText, showingOfText, totalText } from "@/veil/parts/tools/tools-text";

/** The words of the Vendors screen (guide §5.11, §6.7), pure so the tests read them. */

/** The line under the title: "16 vendors, 7 you’re keen on", or the empty line. */
export function vendorsSub(total: number, keen: number): string {
  if (total === 0) return "Everyone you’re considering";
  return `${plural(total, "vendor")}${keen ? `, ${n0(keen)} you’re keen on` : ""}`;
}

export const NOTHING_YET = {
  title: "No vendors yet",
  body: "Add a vendor the moment you hear about one: a name is enough. Prices, reviews and files can follow.",
};

/** What a list with nothing in it says, by what is narrowing it. */
export function noResults(filter: { query: string; category: string; keen: boolean }): { title: string; body: string } {
  const query = filter.query.trim();
  if (query) {
    return {
      title: `No vendors match “${query}”`,
      body: "Search looks through names, contact people and notes.",
    };
  }
  if (filter.keen) {
    return {
      title: "No vendors you’re keen on here",
      body: "Tap the heart on a vendor to mark one you’re keen on.",
    };
  }
  return {
    title: "No vendors in this category yet",
    body: "Add a vendor here, or choose another category.",
  };
}

/** The count line: all of it, the first page, the matches, or the first page of the matches. */
export function countText(total: number, shown: number, filtering: boolean): string {
  if (shown < total) return filtering ? showingOfText(shown, total) : pagedText(total, shown, "vendor");
  return filtering ? hereText(total, "vendor") : totalText(total, "vendor");
}

/** The export link: everything, or only what is in view. */
export const exportLabel = (everything: boolean) => `Export ${everything ? "all" : "these"} to a spreadsheet`;

export const exportedToast = (count: number, fileName: string) => `Exported ${plural(count, "vendor")} to ${fileName}`;

export const addedToast = (name: string) => `Added ${name}`;
export const NAME_MISSING = "Give the vendor a name.";
export const ADD_FAILED =
  "The vendor wasn’t added: the planner lost its connection. Everything you entered is still here.";

// ---------- the categories sheet ----------

export const categoriesSub = (partner: string) =>
  `Categories you add are shared with ${partner}. “Other” is always there for anything that doesn’t fit.`;

/** "Ours, 3 vendors", "Catch-all, 2 vendors", or just "5 vendors" for a built-in. */
export function categoryNote(row: CategoryRow): string {
  const count = plural(row.count, "vendor");
  return row.kind === "ours" ? `Ours, ${count}` : row.kind === "catch-all" ? `Catch-all, ${count}` : count;
}

/** "40 characters left", counting down; past the limit it says how many too many. */
export function charactersNote(left: number): string {
  return left >= 0
    ? `${plural(left, "character")} left`
    : `${plural(-left, "character")} over the limit of ${MAX_CATEGORY_LENGTH}`;
}

/** "Its 4 vendors move to Other." and nothing for a category that holds none. */
export const removeBody = (count: number): string | undefined =>
  count ? `Its ${plural(count, "vendor")} move to Other.` : undefined;

export const categoryAdded = (name: string) => `Added ${name}`;
export const categoryRenamed = (name: string) => `Renamed to ${name}`;
export const categoryRemoved = (name: string) => `Removed ${name}`;
export const CATEGORY_ADD_FAILED = "Couldn’t add the category. What you typed is kept. Try again.";
