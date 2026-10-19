import type { FileItem, FolderItem } from "@/lib/model/files";
import { isObject, legacyFiles, millis, num, str, strOrNull } from "./common";

export type RecordKind = "vendor" | "venue" | "booking" | "finalist";

/** Which record a file or folder belongs to (plan §2.7). */
export interface RecordRef {
  kind: RecordKind;
  id: string;
  partId?: string;
}

const KINDS = new Set<RecordKind>(["vendor", "venue", "booking", "finalist"]);

export function recordRef(raw: unknown): RecordRef | null {
  if (!isObject(raw) || !KINDS.has(raw.kind as RecordKind) || typeof raw.id !== "string") return null;
  return {
    kind: raw.kind as RecordKind,
    id: raw.id,
    ...(typeof raw.partId === "string" && raw.partId ? { partId: raw.partId } : {}),
  };
}

export const sameRecord = (a: RecordRef, b: RecordRef) =>
  a.kind === b.kind && a.id === b.id && (a.partId ?? null) === (b.partId ?? null);

export interface FileDoc {
  id: string;
  name: string;
  url: string;
  folderId: string | null;
  fileType: string;
  fileSize: number;
  publicId: string;
  recordRef: RecordRef | null;
  createdAt: number | null;
}

export function fileFromDoc(id: string, data: Record<string, unknown>): FileDoc {
  return {
    id,
    name: str(data.name) || "Uploaded file",
    url: str(data.url),
    folderId: strOrNull(data.folderId),
    fileType: str(data.fileType),
    fileSize: num(data.fileSize),
    publicId: str(data.publicId),
    recordRef: recordRef(data.recordRef),
    createdAt: millis(data.createdAt),
  };
}

/** A folder as Files shows it. A nameless one reads "Untitled folder". */
export function folderItemFromDoc(id: string, data: Record<string, unknown>): FolderItem {
  return { id, name: str(data.name).trim() || "Untitled folder", parentId: strOrNull(data.parentId) };
}

/** A file as Files shows it: everything its row and its sheet read. */
export function fileItemFromDoc(id: string, data: Record<string, unknown>): FileItem {
  return {
    id,
    name: str(data.name).trim() || "Uploaded file",
    category: str(data.category),
    description: str(data.description),
    folderId: strOrNull(data.folderId),
    url: str(data.url),
    size: num(data.fileSize),
    mime: str(data.fileType),
    addedAt: millis(data.createdAt),
  };
}

/** A file shown on a record: one from Files, or a legacy one not imported yet. */
export interface RecordFile {
  /** The `weddingFiles` id, or null for a legacy file only on the record. */
  id: string | null;
  name: string;
  url: string;
}

/**
 * The files on a record: those in Files whose `recordRef` points at any of
 * `refs` (a booking also shows the files of the vendor or venue it came from,
 * a finalist the files of its source vendor), then legacy files on the record
 * that aren't in Files yet. After migration 1.11 every legacy file is in Files,
 * so the second list is empty; matching by address keeps both from showing a
 * file twice in between.
 */
export function filesForRecord(
  refs: readonly RecordRef[],
  files: readonly FileDoc[],
  legacy: unknown,
): RecordFile[] {
  const own = files
    .filter((f) => f.recordRef && refs.some((r) => sameRecord(r, f.recordRef!)))
    .sort((a, b) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity))
    .map((f) => ({ id: f.id, name: f.name, url: f.url }));
  const seen = new Set(own.map((f) => f.url));
  const rest = legacyFiles(legacy)
    .filter((f) => !seen.has(f.url) && (seen.add(f.url), true))
    .map((f) => ({ id: null, name: f.name, url: f.url }));
  return [...own, ...rest];
}

/**
 * Files added on a record go into a folder named after it, under one folder
 * per kind (guide §4.20: "Into Files › Vendors › Kebun Bunga Atelier"). A
 * part's or package's files go one level deeper, in a folder named after it.
 */
export const RECORD_ROOT_FOLDER: Record<RecordKind, string> = {
  vendor: "Vendors",
  venue: "Venues",
  booking: "Bookings",
  finalist: "Shortlist",
};

/** The folder names from the top of Files down to the record's own folder. */
export function recordFolderPath(ref: RecordRef, recordName: string, partName?: string): string[] {
  const name = recordName.trim() || "Untitled";
  const path = [RECORD_ROOT_FOLDER[ref.kind], name];
  if (ref.partId) path.push(partName?.trim() || "Untitled part");
  return path;
}

/**
 * Where a Cloudinary delivery URL keeps the asset's cloud, type and public id,
 * for files saved before the type or id was stored. For raw files the
 * extension is part of the public id; for images and videos it isn't.
 */
export function cloudinaryAsset(url: string): { cloudName: string; resourceType: string; publicId: string } | null {
  const match = /res\.cloudinary\.com\/([^/]+)\/(image|video|raw)\/upload\/(?:[^/]+\/)*?(?:v\d+\/)(.+)$/.exec(url);
  if (!match) return null;
  const [, cloudName, resourceType, rest] = match;
  const path = decodeURIComponent(rest.split(/[?#]/)[0]);
  return { cloudName, resourceType, publicId: resourceType === "raw" ? path : path.replace(/\.[^./]+$/, "") };
}

/** Where a record keeps its old `files[]`: the document, and a part's id or `null` for the record's own list. */
export interface LegacyPlace {
  collection: string;
  docId: string;
  partId: string | null;
}

export function legacyPlace(ref: RecordRef): LegacyPlace | null {
  const partId = ref.partId ?? null;
  switch (ref.kind) {
    case "vendor":
      return { collection: "vendors", docId: ref.id, partId };
    case "venue":
      return { collection: "venues", docId: ref.id, partId };
    case "finalist":
      return { collection: "shortlist", docId: ref.id, partId };
    case "booking": {
      // Booking ids are `vendor-<id>` or `venue-<id>` (adapters/bookings).
      const match = /^(vendor|venue)-(.+)$/.exec(ref.id);
      return match ? { collection: match[1] === "vendor" ? "vendors" : "venues", docId: match[2], partId } : null;
    }
  }
}
