/**
 * The Documents list (guide §5.16; R6): a document as a card or a row needs it,
 * the list in view (newest first, search through titles and the words inside,
 * tables included, a page of 60), and the words of its counts and empty states.
 *
 * Pure: the data hook reads the stored documents and hands plain values in.
 */
import type { JSONContent } from "@tiptap/core";
import { docLines } from "./documents";
import { plural } from "./format";
import { matches } from "./search";

/** Rows shown at a time (guide §6.8). */
export const DOCS_PAGE = 60;

/** The newest documents drawn as cards when nobody is searching. */
export const RECENT_CARDS = 3;

/** A document as the list uses it. */
export interface DocumentListItem {
  id: string;
  /** Empty for an untitled document. */
  title: string;
  /** Everything written inside, one line, tables included: what the extract and the search read. */
  text: string;
  /** When it was last saved, in ms; `null` while the server hasn't stamped it yet (it reads as just now). */
  editedAt: number | null;
  /** The partner's name when they saved it last, `null` when it was you or the old UI. */
  editedBy: string | null;
}

/** A document's words as one line: blocks and table cells apart by a space, runs of spaces made one. */
export function documentText(content: JSONContent): string {
  return docLines(content).join(" ").replace(/\s+/g, " ").trim();
}

/** Newest first. A document with no stamp yet is the one just saved, so it leads; ties keep a steady order by id. */
export function newestFirst<T extends { id: string; editedAt: number | null }>(docs: readonly T[]): T[] {
  const at = (d: T) => d.editedAt ?? Number.POSITIVE_INFINITY;
  return docs.slice().sort((a, b) => at(b) - at(a) || a.id.localeCompare(b.id));
}

export interface DocumentView {
  /** The newest few, as cards. Empty while searching. */
  recent: DocumentListItem[];
  /** Every other match, newest first: "Earlier" when not searching, the results when searching. */
  rest: DocumentListItem[];
  /** How many of `rest` to draw. */
  shown: number;
  /** What the next "Show N more" shows; 0 when there is nothing more. */
  more: number;
  /** All documents that match: `recent` and `rest` together. */
  matched: number;
}

/**
 * What the list shows: the three newest as cards and the rest as rows, or, with a
 * search, only the matching rows (guide §5.16). `shown` is how many rows are drawn.
 */
export function documentView(
  docs: readonly DocumentListItem[],
  query: string,
  shown: number,
  step: number = DOCS_PAGE,
): DocumentView {
  const searching = query.trim() !== "";
  const found = newestFirst(docs).filter((d) => matches(query, d.title, d.text));
  const recent = searching ? [] : found.slice(0, RECENT_CARDS);
  const rest = searching ? found : found.slice(RECENT_CARDS);
  const visible = Math.min(rest.length, shown);
  return { recent, rest, shown: visible, more: Math.max(0, Math.min(step, rest.length - visible)), matched: found.length };
}

// ---------- the words ----------

/** The line under the title: "6 documents, newest first", or what documents are for when there are none. */
export const documentsSub = (count: number) =>
  count > 0 ? `${plural(count, "document")}, newest first` : "Plans, research and meeting notes";

export const SEARCH_LABEL = "Search documents";
export const SEARCH_PLACEHOLDER = "Search titles and what’s written inside";

export const START_MEETING = "Meeting notes";
export const START_BLANK = "New document";

export const NOTHING_WRITTEN = {
  title: "Nothing written yet",
  body: "Start with meeting notes when you sit down with a vendor: the date, a table for prices and a list for next steps are ready, and everything saves as you type.",
};

export const noResultsTitle = (query: string) => `No documents match “${query.trim()}”`;
export const NO_RESULTS_BODY = "Search looks through titles and everything written inside, tables included.";
export const CLEAR_SEARCH = "Clear the search";

/** "3 documents match", over the results. */
export const matchCount = (matched: number) => `${plural(matched, "document")} match`;

export const EARLIER = "Earlier";
export const earlierCount = (count: number) => plural(count, "document");
