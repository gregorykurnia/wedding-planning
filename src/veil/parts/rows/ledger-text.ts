import type { Booking, FunderId, IsoDate } from "@/lib/model/bookings";
import { dateLong, dueText, MONTH_NAMES, parseIso } from "@/lib/model/dates";
import { andList, dec, plural, rp } from "@/lib/model/format";
import {
  estimateDifference,
  NOT_ASSIGNED,
  totals,
  urgency,
  whatIfParts,
  type Due,
  type Funder,
  type WhatIfRecord,
} from "@/lib/model/money";
import { mbText } from "@/lib/model/uploads";
import type { LineTone, PartLine, PartLineList } from "@/veil/parts/menu-card/menu-text";
import { paidByText } from "@/veil/parts/next-card/next-text";

// The words of the ledger rows (guide §4.7), ported from the prototype's
// bookings, what-if, vendors, payments, documents, files and guests markup. Pure,
// so the components only draw and the tests read the words without rendering.
// `today` is passed in, as everywhere in the model.

/** An empty meta line keeps the row's height with a non-breaking space. */
export const NO_TEXT = " ";

/** A funder's name, or Not assigned when the id is no longer listed. */
export const funderName = (funders: Funder[], id: FunderId) =>
  id === null ? NOT_ASSIGNED : funders.find((f) => f.id === id)?.name || NOT_ASSIGNED;

/** "paid by Greg and Bella", "paid by 3 funders", or "no funder yet" when nobody is named. */
export function bookingPaidBy(funders: FunderId[], names: Funder[]): string {
  if (funders.length === 0 || (funders.length === 1 && funders[0] === null)) return "no funder yet";
  const named =
    funders.length > 2
      ? plural(funders.length, "funder")
      : andList(funders.map((id) => funderName(names, id)));
  return `paid by ${named}`;
}

/** ", Rp 2.000.000 over the estimate" (or under), or nothing when the price is the estimate. */
export function estimateText(b: Booking): string {
  const d = estimateDifference(b);
  if (!d || d.direction === "same") return "";
  return `, ${rp(Math.abs(d.difference))} ${d.direction === "higher" ? "over" : "under"} the estimate`;
}

/** "Catering, paid by Greg and Bella, Rp 2.000.000 over the estimate". */
export function bookingMeta(b: Booking, funders: Funder[]): string {
  return `${b.category || "No category"}, ${bookingPaidBy(totals(b).funders, funders)}${estimateText(b)}`;
}

/**
 * The right of a booking entry: "Rp 1.000.000 to pay", "… late" (rose), "Paid in
 * full" (sage), "Overpaid by …" (rose) or "No price yet". Late is the earliest
 * owing part's date passing. `amount` is the figure inside `text`, which the row
 * sets in tabular numerals; it is null when there is none.
 */
export function bookingStatus(b: Booking, today: IsoDate): { text: string; tone: LineTone; amount: string | null } {
  const t = totals(b);
  if (t.over) return { text: `Overpaid by ${rp(t.overBy)}`, tone: "late", amount: rp(t.overBy) };
  if (t.left === 0) {
    return t.price
      ? { text: "Paid in full", tone: "done", amount: null }
      : { text: "No price yet", tone: "plain", amount: null };
  }
  const late = t.next !== null && urgency(t.next.due, today) === "late";
  return { text: `${rp(t.left)} ${late ? "late" : "to pay"}`, tone: late ? "late" : "plain", amount: rp(t.left) };
}

/** The place-card date: the day and the short month, or `null` for a date that isn't real. */
export function dateCardParts(iso: IsoDate): { day: string; month: string } | null {
  const p = parseIso(iso);
  return p ? { day: String(p.day), month: MONTH_NAMES[p.month - 1].slice(0, 3) } : null;
}

/** "3 days late" (rose), "due in 4 days" within 14 days, or the long date further off. */
export function dueWhen(iso: IsoDate, today: IsoDate): { text: string; late: boolean } {
  const u = urgency(iso, today);
  return { text: u === "later" ? dateLong(iso, today) : dueText(iso, today), late: u === "late" };
}

/** What follows the date in a due's meta: ", paid by Greg", and the part's step after a full stop. */
export function dueTail(due: Due, funders: Funder[]): string {
  const step = due.part.step && due.part.step !== due.part.name ? `. ${due.part.step}` : "";
  return `, ${paidByText(due.funder, funders)}${step}`;
}

/** "4,8 from 120 reviews" as its score and the rest, or `null` for "No rating yet". */
export function ratingParts(rating: number | null, reviewers: number): { score: string; rest: string } | null {
  if (rating === null) return null;
  return { score: dec(rating.toFixed(1)), rest: `from ${plural(reviewers || 0, "review")}` };
}

/** "Catering, Bu Sri" when the list isn't grouped by category, else just the contact. */
export function vendorMeta(category: string | null | undefined, contact: string | null | undefined, showCategory: boolean): string {
  return [showCategory ? category : "", contact].filter(Boolean).join(", ") || NO_TEXT;
}

/** "Catering, would be paid by CK and Bella", with "nobody yet" for a part with no funder. */
export function whatIfMeta(item: WhatIfRecord & { category?: string | null }, funders: Funder[]): string {
  const ids = [...new Set(whatIfParts(item).map((p) => p.funder ?? null))];
  const who =
    ids.length > 2
      ? plural(ids.length, "funder")
      : andList(ids.map((id) => (id === null ? "nobody yet" : funderName(funders, id))));
  return `${item.category || "No category"}, would be paid by ${who}`;
}

/** A what-if item's own parts as ledger lines: the price, then who would pay it. Five at most; the rest are counted. */
export function whatIfPartLines(item: WhatIfRecord, funders: Funder[]): PartLineList {
  const parts = whatIfParts(item);
  const shown = parts.slice(0, 5);
  const lines: PartLine[] = shown.map((p, index) => ({
    key: p.id ?? `line-${index}`,
    name: p.name,
    value: `${rp(p.price)}, ${p.funder === null ? "no funder yet" : funderName(funders, p.funder)}`,
    tone: "plain",
  }));
  return { lines, more: parts.length - shown.length };
}

/**
 * The opening words of a document under its title, or the words around its first
 * match when a search is on. "Empty" for a document with no words.
 */
export function extractText(text: string, query: string): string {
  const q = query.trim();
  if (!text) return "Empty";
  if (!q) return text.slice(0, 220);
  const at = text.toLocaleLowerCase().indexOf(q.toLocaleLowerCase());
  if (at < 0) return text.slice(0, 160);
  const from = Math.max(0, at - 50);
  return (from > 0 ? "…" : "") + text.slice(from, at + q.length + 120);
}

/** "Vendors › Pelaminan Ayu", or "Files" for the top folder. */
export const pathText = (names: string[]) => (names.length ? names.join(" › ") : "Files");

/** A file's meta line: its category (gold), then the description, or the folder it sits in during a search. */
export function fileMeta(
  file: { category?: string | null; description?: string | null },
  path: string[],
  withPath: boolean,
): { category: string; rest: string } {
  return {
    category: file.category || "",
    rest: withPath ? `in ${pathText(path)}` : file.description || "",
  };
}

/** A folder's meta line: "2 folders, 3 files", or "Empty". */
export function folderMeta(folders: number, files: number): string {
  return [folders ? plural(folders, "folder") : "", files ? plural(files, "file") : ""].filter(Boolean).join(", ") || "Empty";
}

/** A file's size, as the upload tiles write it: "2,4 MB". */
export const fileSizeText = (bytes: number) => mbText(bytes);
