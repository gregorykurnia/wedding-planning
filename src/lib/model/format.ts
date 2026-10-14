/**
 * Number and text formats (guide §6.9, §6.11, §4.12; inventory-notes §5 #37).
 *
 * A dot always means thousands and a comma always means decimals, so "4,8" is a
 * rating and "1.206" is a count. Everything here is a pure function; none of it
 * depends on the runtime's locale data.
 */

const DOTS = /\B(?=(\d{3})+(?!\d))/g;

/** Whole number grouped with dots, no sign: 12500000 → "12.500.000". */
export const group = (n: number) => Math.round(Math.abs(n)).toString().replace(DOTS, ".");

/** A count grouped with dots: 1206 → "1.206". Negative counts keep a true minus. */
export const n0 = (n: number) => (n < 0 ? "−" : "") + group(n);

/** Rupiah with the minus first: −Rp 12.500.000 (guide §6.9). */
export const rp = (n: number) => (n < 0 ? "−" : "") + "Rp " + group(n);

export interface FigureParts {
  /** "−" for a negative amount, otherwise "". */
  sign: "−" | "";
  /** Set small and muted before the digits. */
  unit: "Rp";
  digits: string;
}

/** A big figure in pieces, so the screen can set "Rp" small before the number. */
export const figure = (n: number): FigureParts => ({ sign: n < 0 ? "−" : "", unit: "Rp", digits: group(n) });

/** A figure longer than 13 digits shrinks, never wraps (guide §4.4). */
export const isLongFigure = (n: number) => String(Math.round(Math.abs(n))).length > 13;

/** A decimal with a comma: 4.8 → "4,8". */
export const dec = (x: number | string) => String(x).replace(".", ",");

/** "1 guest", "2 guests", "1.206 bookings". Counts are grouped with dots. */
export const plural = (n: number, one: string, many = one + "s") => `${n0(n)} ${n === 1 ? one : many}`;

/** "Ana", "Ana and Budi", "Ana, Budi and Citra". */
export const andList = (items: string[]) =>
  items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];

/** Followers and reviews, short: 12300 → "12,3k", 98765432 → "98,8M"; under 10.000 they stay whole. */
export function compact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (n >= 1e6) return dec(Math.round(n / 1e5) / 10) + "M";
  if (n >= 1e4) {
    const k = Math.round(n / 100) / 10;
    return k >= 1000 ? "1M" : dec(k) + "k";
  }
  return n0(n);
}

/** Cuts long text to `max` characters ending in "…", without splitting a character in two. */
export function cut(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : chars.slice(0, Math.max(0, max - 2)).join("") + "…";
}

export type TextPart = { text: string } | { text: string; href: string };

const WEB_ADDRESS = /https?:\/\/[^\s<]*[^\s<.,;:!?)]/g;

/** Splits text into plain pieces and web addresses; the screen draws the links, nothing is HTML. */
export function linkParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const m of text.matchAll(WEB_ADDRESS)) {
    const index = m.index ?? 0;
    if (index > at) parts.push({ text: text.slice(at, index) });
    parts.push({ text: m[0].replace(/^https?:\/\/(www\.)?/, ""), href: m[0] });
    at = index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}
