import { dec } from "./format";

/**
 * Uploading files (guide §4.20, R9, R10): what a file may be, what each stage
 * of an upload says, and the queue's state. Pure, so the words and the rules
 * are tested without a browser.
 */

/** Cloudinary's free-plan limit. Bigger PDFs are shrunk to fit; anything else is refused. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.txt,image/*";

/** The category suggestions in the upload sheet; any other word may be typed. */
export const FILE_CATEGORIES = [
  "Contract",
  "Quote",
  "Receipt",
  "Invoice",
  "Brochure",
  "Moodboard",
  "Photo",
  "ID and legal",
  "Guest list",
  "Seating plan",
];

/** "14,2 MB", "48 MB", "620 KB", "1,5 GB": a dot always means thousands, so decimals take a comma. */
export function mbText(bytes: number): string {
  const mb = bytes / 1_048_576;
  if (mb >= 1024) return `${dec(Math.round(mb / 102.4) / 10)} GB`;
  if (mb < 1) return `${Math.max(1, Math.round(mb * 1024))} KB`;
  return `${dec(Math.round(mb * 10) / 10)} MB`;
}

/** The size line under a tile: "2,4 MB", or "2,4 MB, from the vendor". */
export function sizeLine(bytes: number, fromVendor = false): string {
  return `${mbText(bytes)}${fromVendor ? ", from the vendor" : ""}`;
}

export const isPdf = (name: string, type = "") => type === "application/pdf" || /\.pdf$/i.test(name);

export const isImage = (name: string, type = "") =>
  type.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|heic|bmp|svg)$/i.test(name);

/** What a tile's thumbnail says when there's no picture: the file's own ending, "pdf", "xlsx". */
export function extLabel(name: string): string {
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(name);
  return match ? match[1].toLowerCase() : "file";
}

/** The ending, with its dot, to put back after a name the user edited. */
export const extOf = (name: string) => /\.[A-Za-z0-9]{1,5}$/.exec(name)?.[0] ?? "";

/** The queue's name field starts as the file's name without its ending. */
export const baseName = (name: string) => name.replace(/\.[A-Za-z0-9]{1,5}$/, "");

/** The name a file is saved under: what was typed (or the file's own name), plus its ending. */
export function savedName(original: string, typed: string): string {
  return (typed.trim() || baseName(original)) + extOf(original);
}

export type UploadPlan = "upload" | "shrink" | "too-large";

/** A PDF over the limit is shrunk; any other file over it is refused. */
export function planUpload(name: string, type: string, bytes: number): UploadPlan {
  if (bytes <= MAX_UPLOAD_BYTES) return "upload";
  return isPdf(name, type) ? "shrink" : "too-large";
}

export const tooLargeText = (bytes: number) =>
  `Too large: ${mbText(bytes)}. Files can be up to 10 MB; only PDFs are shrunk.`;

/** A PDF that is still over the limit after shrinking (N17, guide §4.20): its own words, so it isn't read as the size message above. */
export const stillTooLargeText = (from: number, to: number) =>
  `Shrunk from ${mbText(from)} to ${mbText(to)}, still over 10 MB. Shrinking wasn’t enough, so it wasn’t uploaded. Choose a smaller PDF, or split it into parts.`;

export const FAILED_TEXT = "Upload failed.";
export const DEMO_TEXT = "Not uploaded: demonstration mode";
export const DEMO_LINE = "Demonstration mode: uploading is turned off.";

/** "Uploading, 1,3 of 2,1 MB", for a tile, which has less room than the sheet's percent. */
export function transferText(loaded: number, total: number): string {
  const unit = mbText(total).split(" ")[1];
  const scale = unit === "KB" ? 1024 : unit === "GB" ? 1_073_741_824 : 1_048_576;
  const done = Math.round((loaded / scale) * 10) / 10;
  return `Uploading, ${dec(unit === "KB" ? Math.round(loaded / 1024) : done)} of ${mbText(total)}`;
}

/** Where a file goes, in words: "Into Files › Vendors › Kebun Bunga Atelier". */
export const intoLine = (path: readonly string[]) => `Into ${["Files", ...path].join(" › ")}`;

export type UploadStatus = "shrinking" | "uploading" | "done" | "failed" | "too-large" | "demo";

export interface UploadItem {
  id: string;
  /** The file's own name, as chosen on the device. */
  name: string;
  /** Bytes as chosen. */
  size: number;
  mime: string;
  status: UploadStatus;
  /** Bytes sent so far, and the bytes being sent (the shrunk size once it is shrunk). */
  loaded: number;
  total: number;
  /** Set when a PDF was shrunk: the size it ended at. */
  shrunkTo: number | null;
  /** Only for `too-large` after shrinking: the size it still had. */
  stillOver: number | null;
  /** The `weddingFiles` document, once it exists. */
  fileId: string | null;
}

export type UploadAction =
  | { type: "add"; item: UploadItem }
  | { type: "shrunk"; id: string; bytes: number }
  | { type: "progress"; id: string; loaded: number; total: number }
  | { type: "sent"; id: string }
  | { type: "done"; id: string; fileId: string }
  | { type: "failed"; id: string }
  | { type: "too-large"; id: string; stillOver: number }
  | { type: "retry"; id: string }
  | { type: "clear-finished" };

const FINISHED: UploadStatus[] = ["done", "too-large", "demo"];

export function newItem(
  id: string,
  file: { name: string; size: number; type: string },
  demo: boolean,
): UploadItem {
  const plan = planUpload(file.name, file.type, file.size);
  const status: UploadStatus =
    plan === "too-large" ? "too-large" : demo ? "demo" : plan === "shrink" ? "shrinking" : "uploading";
  return {
    id,
    name: file.name,
    size: file.size,
    mime: file.type,
    status,
    loaded: 0,
    total: file.size,
    shrunkTo: null,
    stillOver: null,
    fileId: null,
  };
}

const patch = (items: UploadItem[], id: string, change: (item: UploadItem) => Partial<UploadItem>) =>
  items.map((item) => (item.id === id ? { ...item, ...change(item) } : item));

export function uploadReducer(items: UploadItem[], action: UploadAction): UploadItem[] {
  switch (action.type) {
    case "add":
      return [...items, action.item];
    case "shrunk":
      return patch(items, action.id, () => ({ status: "uploading", shrunkTo: action.bytes, total: action.bytes, loaded: 0 }));
    case "progress":
      return patch(items, action.id, () => ({ status: "uploading", loaded: action.loaded, total: action.total }));
    case "sent":
      return patch(items, action.id, (item) => ({ loaded: item.total }));
    case "done":
      return patch(items, action.id, () => ({ status: "done", fileId: action.fileId }));
    case "failed":
      return patch(items, action.id, () => ({ status: "failed" }));
    case "too-large":
      return patch(items, action.id, () => ({ status: "too-large", stillOver: action.stillOver }));
    case "retry":
      return patch(items, action.id, (item) => ({
        status: item.shrunkTo === null && planUpload(item.name, item.mime, item.size) === "shrink" ? "shrinking" : "uploading",
        loaded: 0,
      }));
    case "clear-finished":
      return items.filter((item) => !FINISHED.includes(item.status));
  }
}

export type StatusTone = "plain" | "ok" | "bad";

export interface StatusView {
  text: string;
  tone: StatusTone;
  /** The status ends with a Try again after `text`. */
  retry: boolean;
  /** 0 to 100 for the bar, or null when the share isn't known (shrinking) or there is no bar. */
  percent: number | null;
  /** A bar is drawn under the name. */
  bar: boolean;
}

const percentOf = (item: UploadItem) =>
  item.total > 0 ? Math.min(100, Math.round((item.loaded / item.total) * 100)) : 0;

/** The words under a file's name in the sheet's queue (`short` false) or on its tile (`short` true). */
export function statusView(item: UploadItem, short = false): StatusView {
  switch (item.status) {
    case "shrinking":
      return {
        text: `Shrinking from ${mbText(item.size)} to fit under 10 MB`,
        tone: "plain",
        retry: false,
        percent: null,
        bar: true,
      };
    case "uploading":
      return {
        text: short ? transferText(item.loaded, item.total) : `Uploading, ${percentOf(item)}%`,
        tone: "plain",
        retry: false,
        percent: percentOf(item),
        bar: true,
      };
    case "done":
      return {
        text: item.shrunkTo === null ? "Uploaded" : `Uploaded, shrunk to ${mbText(item.shrunkTo)}`,
        tone: "ok",
        retry: false,
        percent: 100,
        bar: true,
      };
    case "failed":
      return { text: FAILED_TEXT, tone: "bad", retry: true, percent: null, bar: false };
    case "too-large":
      return {
        text: item.stillOver === null ? tooLargeText(item.size) : stillTooLargeText(item.size, item.stillOver),
        tone: "bad",
        retry: false,
        percent: null,
        bar: false,
      };
    case "demo":
      return { text: DEMO_TEXT, tone: "bad", retry: false, percent: null, bar: false };
  }
}

/** What the queue's three fields hold. */
export interface FileFields {
  name: string;
  category: string;
  description: string;
}

/**
 * A picture on Cloudinary, asked for at tile size (cropped to fill, 320 by 192)
 * rather than at full size. Any other address comes back as it was.
 */
export function thumbUrl(url: string): string {
  return /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url)
    ? url.replace("/image/upload/", "/image/upload/c_fill,w_320,h_192,f_auto,q_auto/")
    : url;
}
