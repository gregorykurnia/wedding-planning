import { matchText, showingOfText } from "@/veil/parts/tools/tools-text";

// The words of the Bookings screen (guide §5.5, §6.7 and §6.8). Pure, so the view
// draws them and the tests read them without rendering.

/** The line under the title when nothing is booked. */
export const NOTHING_SUB = "Everything you’ve committed to";
export const NOTHING_TITLE = "Nothing booked yet";
export const NOTHING_BODY =
  "Choosing a vendor or booking a venue adds it here. For anything that skipped the comparison, add it yourself.";
export const ADD_BOOKING = "Add booking";
export const SEARCH_BOOKINGS = "Search bookings";
export const CLEAR_SEARCH = "Clear the search";
export const NO_RESULTS_BODY = "Search looks through names, categories, parts, next steps and funders.";

/** "No bookings match “fireworks”": the search as it was typed, without its edge spaces. */
export const noResultsTitle = (query: string) => `No bookings match “${query.trim()}”`;

/**
 * The count above the list (guide §6.8). While a search is on, how many match;
 * otherwise "Showing 100 of 1.206" once the list pages. Nothing when all of it fits.
 */
export function countText(query: string, total: number, visible: number): string | null {
  if (query.trim()) return matchText(total, "booking");
  return visible < total ? showingOfText(visible, total) : null;
}
