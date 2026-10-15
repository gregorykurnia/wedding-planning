import { n0, plural } from "@/lib/model/format";

// The words of the search and ordering tools (guide §4.12 and §6.8). The
// components show them and the tests read them. Counts use the model's dots.

/** "Sorted by vendor for now. Your own order is kept." The order's label, lower-cased. */
export const sortedNoteText = (label: string) => `Sorted by ${label.toLowerCase()} for now. Your own order is kept.`;

/** "12 vendors": every match is shown and nothing is filtered. */
export const totalText = (total: number, noun: string) => plural(total, noun);

/** "1.206 bookings, showing 100": paged, nothing filtered. */
export const pagedText = (total: number, shown: number, noun: string) => `${plural(total, noun)}, showing ${n0(shown)}`;

/** "12 vendors here": filtered, and every match is shown. */
export const hereText = (total: number, noun: string) => `${plural(total, noun)} here`;

/** "3 bookings match", and "1 booking matches" for one. */
export const matchText = (total: number, noun: string) =>
  total === 1 ? `${n0(total)} ${noun} matches` : `${plural(total, noun)} match`;

/** "12 of 2.004": how many match out of all of them. */
export const ofText = (matched: number, total: number) => `${n0(matched)} of ${n0(total)}`;

/** "Showing 60 of 1.507": paged and filtered. */
export const showingOfText = (shown: number, total: number) => `Showing ${n0(shown)} of ${n0(total)}`;

/** "Show 100 more": the button always says how many more it shows. */
export const moreText = (more: number) => `Show ${n0(more)} more`;
