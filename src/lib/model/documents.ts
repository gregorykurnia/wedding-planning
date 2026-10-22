/**
 * Documents (guide §4.24, §5.17, §6.13; plan §9.2 Q7 and Q10). Pure: the stored
 * Tiptap JSON read and normalised, the four fonts and sizes, the meeting-notes
 * start, links, and the words of the save state and the leave question.
 *
 * Stored documents (`notes`) are Tiptap JSON written by StarterKit, TextStyleKit
 * and TableKit. The new editor keeps that schema, so the old UI still opens
 * what the new one saves. On opening, fonts and sizes are mapped to the new four
 * (Q10); colours are kept exactly as typed.
 */
import type { JSONContent } from "@tiptap/core";
import { SAVE_OFFLINE } from "./save-state";

export type DocFontKey = "jost" | "cormorant" | "georgia" | "mono";
export type DocSizeKey = "small" | "normal" | "large" | "huge";

/**
 * The toolbar's fonts. `stored` is what goes in the `fontFamily` attribute;
 * Jost is the body font, so it is no attribute at all. Mono is stored as
 * "Courier New", which old documents already use and the old UI draws as mono.
 */
export const DOC_FONTS: readonly { key: DocFontKey; label: string; stored: string | null }[] = [
  { key: "jost", label: "Jost", stored: null },
  { key: "cormorant", label: "Cormorant", stored: "Cormorant Garamond" },
  { key: "georgia", label: "Georgia", stored: "Georgia" },
  { key: "mono", label: "Mono", stored: "Courier New" },
];

/** The toolbar's sizes, stored in px as the old UI stored them. Normal is no attribute. */
export const DOC_SIZES: readonly { key: DocSizeKey; label: string; stored: string | null }[] = [
  { key: "small", label: "Small", stored: "14px" },
  { key: "normal", label: "Normal", stored: null },
  { key: "large", label: "Large", stored: "22px" },
  { key: "huge", label: "Huge", stored: "30px" },
];

export type DocBlockKey = "paragraph" | "title" | "heading" | "subheading" | "quote" | "code";

/** The Text style choices (guide §4.24). Title, Heading and Subheading are heading levels 1–3. */
export const DOC_BLOCKS: readonly { key: DocBlockKey; label: string }[] = [
  { key: "paragraph", label: "Body text" },
  { key: "title", label: "Title" },
  { key: "heading", label: "Heading" },
  { key: "subheading", label: "Subheading" },
  { key: "quote", label: "Quote" },
  { key: "code", label: "Code" },
];

/**
 * The text colours and highlights, each a token of the document palette
 * (tokens.css §4). Ink is the text's own colour, so choosing it takes the
 * colour off (`clears`), and None takes the highlight off.
 */
export interface DocSwatch {
  label: string;
  token: string | null;
  clears?: boolean;
}

export const DOC_COLOURS: readonly DocSwatch[] = [
  { label: "Ink", token: "--doc-ink-ink", clears: true },
  { label: "Rose", token: "--doc-ink-rose" },
  { label: "Gold", token: "--doc-ink-gold" },
  { label: "Sage", token: "--doc-ink-sage" },
  { label: "Cornflower", token: "--doc-ink-cornflower" },
  { label: "Plum", token: "--doc-ink-plum" },
];

export const DOC_HIGHLIGHTS: readonly DocSwatch[] = [
  { label: "Blush", token: "--doc-mark-blush" },
  { label: "Champagne", token: "--doc-mark-champagne" },
  { label: "Mint", token: "--doc-mark-mint" },
  { label: "Sky", token: "--doc-mark-sky" },
  { label: "Lilac", token: "--doc-mark-lilac" },
  { label: "None", token: null, clears: true },
];

/** The first family in a CSS font list, lower case, without quotes. */
function firstFamily(value: string): string {
  return value.split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase();
}

/**
 * Which of the four fonts a stored family is (Q10): Inter, Arial, nothing and
 * anything unknown read as Jost; Georgia as Georgia; Courier New and other
 * monospaced families as Mono.
 */
export function fontKeyOf(stored: unknown): DocFontKey {
  if (typeof stored !== "string" || !stored.trim()) return "jost";
  const family = firstFamily(stored);
  if (family.startsWith("cormorant")) return "cormorant";
  if (family === "georgia") return "georgia";
  if (/^(courier|ui-monospace|monospace|mono$|menlo|consolas|sf mono)/.test(family)) return "mono";
  return "jost";
}

/**
 * Which of the four sizes a stored size is (Q10): the old 14, 16, 20 and 28px
 * are Small, Normal, Large and Huge; any other size goes to the nearest.
 */
export function sizeKeyOf(stored: unknown): DocSizeKey {
  if (typeof stored !== "string") return "normal";
  const m = /^\s*(\d+(?:\.\d+)?)\s*px\s*$/i.exec(stored);
  if (!m) return "normal";
  const px = Number(m[1]);
  if (px < 15) return "small";
  if (px < 18) return "normal";
  if (px < 25) return "large";
  return "huge";
}

export const fontStored = (key: DocFontKey) => DOC_FONTS.find((f) => f.key === key)?.stored ?? null;
export const sizeStored = (key: DocSizeKey) => DOC_SIZES.find((s) => s.key === key)?.stored ?? null;

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isFilled = (v: unknown) => v !== null && v !== undefined && v !== "";

type Mark = NonNullable<JSONContent["marks"]>[number];

/** A textStyle mark with its font and size mapped; null when nothing is left in it. */
function normaliseTextStyle(mark: Mark): Mark | null {
  const attrs: Record<string, unknown> = { ...(mark.attrs ?? {}) };
  if ("fontFamily" in attrs) attrs.fontFamily = fontStored(fontKeyOf(attrs.fontFamily));
  if ("fontSize" in attrs) attrs.fontSize = sizeStored(sizeKeyOf(attrs.fontSize));
  if (!Object.values(attrs).some(isFilled)) return null;
  return { ...mark, attrs };
}

function normaliseNode(node: JSONContent): JSONContent {
  const out: JSONContent = { ...node };
  if (Array.isArray(node.marks)) {
    const marks = node.marks
      .filter((m): m is Mark => isRecord(m) && typeof m.type === "string")
      .map((m) => (m.type === "textStyle" ? normaliseTextStyle(m) : m))
      .filter((m): m is Mark => m !== null);
    if (marks.length) out.marks = marks;
    else delete out.marks;
  }
  if (Array.isArray(node.content)) {
    out.content = node.content
      .filter((c): c is JSONContent => isRecord(c) && typeof c.type === "string")
      .map(normaliseNode);
  }
  return out;
}

/**
 * A stored document's content as the editor opens it: always a `doc` with at
 * least one block, fonts and sizes mapped to the four (Q10), everything else,
 * colours included, as stored. Doing it twice changes nothing.
 */
export function normaliseDoc(content: unknown): JSONContent {
  if (!isRecord(content) || content.type !== "doc") return EMPTY_DOC;
  const doc = normaliseNode(content as JSONContent);
  if (!doc.content?.length) doc.content = [{ type: "paragraph" }];
  return doc;
}

/** A legacy plain-text note (`text`) as paragraphs, one per line. */
export function plainTextDoc(text: string): JSONContent {
  const content = text.split(/\r?\n/).map((line) => ({
    type: "paragraph",
    ...(line ? { content: [{ type: "text", text: line }] } : {}),
  }));
  return { type: "doc", content: content.length ? content : EMPTY_DOC.content };
}

/** The old UI's default title for a document nobody named; the new UI shows "Untitled" in its place. */
const LEGACY_UNTITLED = "Untitled document";

export function docTitleOf(stored: unknown): string {
  if (typeof stored !== "string") return "";
  return stored.trim() === LEGACY_UNTITLED ? "" : stored;
}

/** A title to put in a sentence: “Meeting: Kebun Bunga Atelier”, or “Untitled”. */
export const titleOrUntitled = (title: string) => title.trim() || "Untitled";

/**
 * The same text for the same value whatever order its keys are in, so content
 * read back from Firestore (keys sorted) compares equal to what the editor made.
 * Undefined values are left out, as Firestore leaves them out.
 */
export function stableKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : stableKey(v))).join(",")}]`;
  if (isRecord(value)) {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableKey(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** A short fingerprint of a text (FNV-1a), to tell whether stored content is the copy we wrote. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * How deeply a value nests maps and arrays. Firestore refuses a field nested
 * more than 20 deep, and Tiptap JSON takes two levels per node, so lists four
 * deep already pass it.
 */
export function nestingDepth(value: unknown): number {
  if (Array.isArray(value)) return 1 + value.reduce<number>((d, v) => Math.max(d, nestingDepth(v)), 0);
  if (isRecord(value)) return 1 + Object.values(value).reduce<number>((d, v) => Math.max(d, nestingDepth(v)), 0);
  return 0;
}

export const FIRESTORE_MAX_DEPTH = 20;

/** Every block's text in reading order, one line each (tables cell by cell). */
export function docLines(doc: JSONContent): string[] {
  const lines: string[] = [];
  const textOf = (n: JSONContent): string =>
    n.type === "text" ? (n.text ?? "") : n.type === "hardBreak" ? "\n" : (n.content ?? []).map(textOf).join("");
  const walk = (n: JSONContent) => {
    const kids = n.content ?? [];
    const holdsText = kids.length > 0 && kids.every((k) => k.type === "text" || k.type === "hardBreak");
    if (holdsText || n.type === "paragraph" || n.type === "heading" || n.type === "codeBlock") {
      lines.push(...textOf(n).split("\n"));
      return;
    }
    kids.forEach(walk);
  };
  walk(doc);
  return lines;
}

/** Today's date in bold, then the layout of meeting notes (guide §6.13). */
export function meetingNotesDoc(dateText: string): JSONContent {
  const text = (t: string, bold = false): JSONContent =>
    bold ? { type: "text", text: t, marks: [{ type: "bold" }] } : { type: "text", text: t };
  const para = (...content: JSONContent[]): JSONContent =>
    content.length ? { type: "paragraph", content } : { type: "paragraph" };
  const heading = (t: string): JSONContent => ({ type: "heading", attrs: { level: 2 }, content: [text(t)] });
  const cell = (type: "tableHeader" | "tableCell", t = ""): JSONContent => ({
    type,
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [t ? para(text(t)) : para()],
  });
  const row = (...cells: JSONContent[]): JSONContent => ({ type: "tableRow", content: cells });
  return {
    type: "doc",
    content: [
      para(text(dateText, true), text(". Who was there: ")),
      heading("What they said"),
      para(),
      heading("Prices"),
      {
        type: "table",
        content: [
          row(cell("tableHeader", "Item"), cell("tableHeader", "Price")),
          row(cell("tableCell"), cell("tableCell")),
          row(cell("tableCell"), cell("tableCell")),
          // A growing total: it keeps counting as rows are added above it (guide §6.10).
          row(cell("tableCell", "Total"), cell("tableCell", "=SUM(B2:B)")),
        ],
      },
      heading("Next steps"),
      { type: "bulletList", content: [{ type: "listItem", content: [para()] }] },
    ],
  };
}

export const MEETING_TITLE = "Meeting: ";

/**
 * What a typed web address becomes: "kebunbunga.id" → "https://kebunbunga.id".
 * Web, mail and phone links are allowed; any other scheme (javascript:, data:)
 * is refused with null, as is an empty address.
 */
export function linkHref(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase();
  if (!scheme) return /\s/.test(value) ? null : `https://${value}`;
  if (["http", "https", "mailto", "tel"].includes(scheme)) return value;
  // "localhost:3000" and "kebun.id:8080/x" look like a scheme but are addresses.
  if (/^[^/]+:\d+/.test(value)) return `https://${value}`;
  return null;
}

/** The address as the link bubble shows it: no scheme or "www.", at most 40 characters. */
export function linkLabel(href: string): string {
  return href.replace(/^(https?:\/\/)?(www\.)?/i, "").replace(/^mailto:/i, "").slice(0, 40);
}

export type DocSaveKind = "saved" | "unsaved" | "saving" | "failed" | "offline" | "demo";

/** The save state's words (guide §4.24), without the Try again link that follows a failure. */
export function docSaveText(kind: DocSaveKind, savedAgo: string | null): string {
  switch (kind) {
    case "saved":
      return savedAgo ? `Saved ${savedAgo}` : "Saved";
    case "unsaved":
      return "Not saved yet";
    case "saving":
      return "Saving";
    case "failed":
      return "Couldn’t save your last changes. They’re still here.";
    case "offline":
      return SAVE_OFFLINE;
    case "demo":
      return "Demonstration mode: not saved";
  }
}

/** The question when leaving after a change didn't save (guide §6.1, N18). */
export function leaveQuestion(offline: boolean) {
  return {
    title: "Your last changes aren’t saved",
    body: `${offline ? "You’re offline, so the planner couldn’t save them." : "The planner couldn’t save them."} If you leave now, they’re lost. Stay and they’re still here to save.`,
    leave: "Leave without them",
    stay: "Stay and try again",
  };
}

/** The delete confirm (guide §5.17, R7): permanent, so it says so and there is no undo. */
export function deleteQuestion(title: string, partner: string) {
  return {
    title: `Delete “${titleOrUntitled(title)}”?`,
    body: `This can’t be undone. The document and everything in it, tables included, will be gone for you and ${partner}.`,
    action: "Delete for good",
  };
}
