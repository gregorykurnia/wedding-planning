/**
 * Files (guide §5.18; R8–R14): the folder tree, what a folder shows, the search
 * across every folder, the path above a folder, the move sheet's choices, and
 * the words of the screen. Pure: the data hook reads every folder and file once
 * and hands plain values in, so a folder opens without waiting for anything.
 */
import type { IsoDate } from "./bookings";
import { localIso } from "./dates";
import { n0, plural } from "./format";
import { matches } from "./search";
import { isImage, mbText, thumbUrl } from "./uploads";

/** Files shown at a time in a folder, and hits at a time in a search (guide §6.8). */
export const FILES_PAGE = 100;
export const HITS_PAGE = 200;

/** Deeper than any real tree; stops a loop in broken data from hanging a walk. */
const MAX_DEPTH = 100;

/** The move tree indents this many levels at most (guide §4.20). */
export const MOVE_INDENT_MAX = 12;

/** The path folds into "…" once it has more levels than this (guide §4.20). */
export const CRUMBS_MAX = 4;

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
}

export interface FileItem {
  id: string;
  name: string;
  category: string;
  description: string;
  folderId: string | null;
  url: string;
  /** Bytes. */
  size: number;
  mime: string;
  /** When it was added, in ms; `null` while the server hasn't stamped it yet (it reads as now). */
  addedAt: number | null;
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

/** Newest first; a file with no stamp yet is the one just added, so it leads. Ties keep a steady order by id. */
export function newestFirst<T extends { id: string; addedAt: number | null }>(files: readonly T[]): T[] {
  const at = (f: T) => f.addedAt ?? Number.POSITIVE_INFINITY;
  return files.slice().sort((a, b) => at(b) - at(a) || a.id.localeCompare(b.id));
}

// ---------- the tree ----------

export interface FolderTree {
  byId: ReadonlyMap<string, FolderItem>;
  /** The folders directly inside `parentId` (`null` is the top), by name. */
  kids(parentId: string | null): FolderItem[];
  /** The folders from the top down to `id`, `id` last. Empty for the top level or an unknown id. */
  path(id: string | null): FolderItem[];
  /** `id` and every folder inside it, however deep. */
  within(id: string): string[];
}

export function folderTree(folders: readonly FolderItem[]): FolderTree {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const children = new Map<string | null, FolderItem[]>();
  for (const folder of folders) {
    // A folder whose parent is missing is shown at the top rather than lost.
    const parent = folder.parentId !== null && byId.has(folder.parentId) ? folder.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), folder]);
  }
  for (const list of children.values()) list.sort(byName);

  const kids = (parentId: string | null) => children.get(parentId) ?? [];

  const path = (id: string | null) => {
    const out: FolderItem[] = [];
    let at = id === null ? undefined : byId.get(id);
    for (let depth = 0; at && depth < MAX_DEPTH && !out.includes(at); depth++) {
      out.unshift(at);
      at = at.parentId === null ? undefined : byId.get(at.parentId);
    }
    return out;
  };

  const within = (id: string) => {
    const all: string[] = [];
    const walk = (at: string, depth: number) => {
      if (depth > MAX_DEPTH || all.includes(at)) return;
      all.push(at);
      for (const kid of kids(at)) walk(kid.id, depth + 1);
    };
    walk(id, 0);
    return all;
  };

  return { byId, kids, path, within };
}

/** "Files", or "Vendors › Catering": the folder names from the top. */
export const pathName = (names: readonly string[]) => ["Files", ...names].join(" › ");

/** Where a folder (or the top, with `null`) is, as words: "Files › Vendors › Catering". */
export const placeName = (tree: FolderTree, id: string | null) => pathName(tree.path(id).map((f) => f.name));

// ---------- what a folder shows ----------

export interface FolderRowItem {
  id: string;
  name: string;
  folders: number;
  files: number;
}

export interface FolderView {
  folders: FolderRowItem[];
  /** Newest first. */
  files: FileItem[];
}

/** Which folder a file is shown in: its own, or the top when that folder is gone (broken data). */
const homeOf = (tree: FolderTree, file: FileItem) =>
  file.folderId !== null && tree.byId.has(file.folderId) ? file.folderId : null;

/** The files directly in each folder (`null` is the top). */
function filesByFolder(tree: FolderTree, files: readonly FileItem[]): Map<string | null, FileItem[]> {
  const out = new Map<string | null, FileItem[]>();
  for (const file of files) {
    const home = homeOf(tree, file);
    out.set(home, [...(out.get(home) ?? []), file]);
  }
  return out;
}

/** What `here` holds: its folders with their counts, then its files, newest first. */
export function folderView(tree: FolderTree, files: readonly FileItem[], here: string | null): FolderView {
  const held = filesByFolder(tree, files);
  return {
    folders: tree.kids(here).map((f) => ({
      id: f.id,
      name: f.name,
      folders: tree.kids(f.id).length,
      files: held.get(f.id)?.length ?? 0,
    })),
    files: newestFirst(held.get(here) ?? []),
  };
}

/** How many of `count` to draw, and what "Show N more" shows next. */
export function paging(count: number, shown: number, step: number): { shown: number; more: number } {
  const visible = Math.min(count, shown);
  return { shown: visible, more: Math.max(0, Math.min(step, count - visible)) };
}

export interface SearchView {
  /** Every match, newest first. */
  hits: FileItem[];
  shown: number;
  more: number;
}

/** Search across every folder, by file name and description (guide §5.18). */
export function searchFiles(files: readonly FileItem[], query: string, shown: number = HITS_PAGE): SearchView {
  const hits = newestFirst(files.filter((f) => matches(query, f.name, f.description)));
  return { hits, ...paging(hits.length, shown, HITS_PAGE) };
}

// ---------- the path above a folder ----------

export interface Crumb {
  /** `null` is the top level, "Files". */
  id: string | null;
  name: string;
}

/**
 * The path above a folder's title (guide §4.20): "Files › Vendors › Catering",
 * without the folder itself. Past four levels the middle folds into one `null`,
 * the "…" that opens the full path; the first and the last two stay.
 */
export function crumbs(tree: FolderTree, here: string | null, full = false): (Crumb | null)[] {
  if (here === null) return [];
  const all: Crumb[] = [{ id: null, name: "Files" }, ...tree.path(here).slice(0, -1).map((f) => ({ id: f.id, name: f.name }))];
  return all.length > CRUMBS_MAX && !full ? [all[0], null, ...all.slice(-2)] : all;
}

// ---------- moving ----------

export type Mover = { kind: "file"; folderId: string | null } | { kind: "folder"; id: string; parentId: string | null };

export interface MoveOption {
  /** `null` is the top level. */
  id: string | null;
  name: string;
  /** Indent level, 1 for a folder at the top, at most 12. */
  depth: number;
  disabled: boolean;
  /** "(it's here now)", "(inside it)", "(this folder)", or empty. */
  note: string;
}

/**
 * The choices in the move sheet: the top level, then every folder in tree order
 * (guide §4.20). Where the thing already is, the folder being moved and
 * everything inside it are off, each with its note, so a folder can never be
 * chosen to go inside itself.
 */
export function moveOptions(tree: FolderTree, mover: Mover): MoveOption[] {
  const from = mover.kind === "file" ? mover.folderId : mover.parentId;
  const inside = mover.kind === "folder" ? tree.within(mover.id) : [];
  const note = (id: string | null) => {
    if (id === from) return "(it's here now)";
    if (mover.kind === "folder" && id === mover.id) return "(this folder)";
    return id !== null && inside.includes(id) ? "(inside it)" : "";
  };
  const options: MoveOption[] = [
    { id: null, name: "Files, the top level", depth: 0, disabled: from === null, note: from === null ? "(it's here now)" : "" },
  ];
  const walk = (parent: string | null, depth: number, seen: number) => {
    if (seen > MAX_DEPTH) return;
    for (const folder of tree.kids(parent)) {
      const n = note(folder.id);
      options.push({ id: folder.id, name: folder.name, depth: Math.min(depth, MOVE_INDENT_MAX), disabled: n !== "", note: n });
      walk(folder.id, depth + 1, seen + 1);
    }
  };
  walk(null, 1, 0);
  return options;
}

/** What is inside a folder, all the way down: counts for the move sheet and the delete check. */
export function holdings(tree: FolderTree, files: readonly FileItem[], folderId: string): { files: number; folders: number } {
  const ids = new Set(tree.within(folderId));
  return { files: files.filter((f) => ids.has(homeOf(tree, f) ?? "")).length, folders: ids.size - 1 };
}

/** "4 files and 1 folder", "3 files", "2 folders" or "". */
export function holdingsText({ files, folders }: { files: number; folders: number }): string {
  return [files ? plural(files, "file") : "", folders ? plural(folders, "folder") : ""].filter(Boolean).join(" and ");
}

/** Whether a sibling folder already has this name (ignoring case). */
export function nameTaken(tree: FolderTree, parentId: string | null, name: string, exceptId?: string): boolean {
  const wanted = name.trim().toLocaleLowerCase();
  return tree.kids(parentId).some((f) => f.id !== exceptId && f.name.toLocaleLowerCase() === wanted);
}

// ---------- a file as a row, a sheet and a link ----------

/** A file's addresses: a picture's thumbnail, and the link that saves it instead of opening it. */
export const thumbOf = (file: Pick<FileItem, "name" | "mime" | "url">) =>
  isImage(file.name, file.mime) ? thumbUrl(file.url) : null;

/** A picture for the file sheet's preview: Cloudinary resizes it to fit 800 by 360 (a few hundred KB, not the 10 MB original). */
export function previewOf(file: Pick<FileItem, "name" | "mime" | "url">): string | null {
  if (!isImage(file.name, file.mime)) return null;
  return /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(file.url)
    ? file.url.replace("/image/upload/", "/image/upload/c_limit,w_800,h_360,f_auto,q_auto/")
    : file.url;
}

/** Cloudinary saves a file rather than showing it when asked with `fl_attachment`; other addresses stay as they are. */
export function downloadUrl(url: string): string {
  return /^https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video|raw)\/upload\//.test(url)
    ? url.replace("/upload/", "/upload/fl_attachment/")
    : url;
}

/** When a file was added, as a day; a file the server hasn't stamped yet was added today. */
export const addedOn = (file: Pick<FileItem, "addedAt">, today: IsoDate): IsoDate =>
  file.addedAt === null ? today : localIso(new Date(file.addedAt));

// ---------- the words ----------

/** The line under "Files": "14 files, 33,1 MB in all", or what the screen is for when there are none. */
export const topSub = (count: number, bytes: number) =>
  count > 0 ? `${plural(count, "file")}, ${mbText(bytes)} in all` : "Contracts, quotes, receipts and photos";

/** The line under a folder's name: "2 folders, 5 files", or "Empty". */
export const folderSub = (folders: number, files: number) =>
  [folders ? plural(folders, "folder") : "", files ? plural(files, "file") : ""].filter(Boolean).join(", ") || "Empty";

export const UPLOAD_FILES = "Upload files";
export const NEW_FOLDER = "New folder";
export const RENAME = "Rename";
export const MOVE = "Move";
export const DELETE_FOLDER = "Delete folder";

export const SEARCH_LABEL = "Find a file";
export const SEARCH_PLACEHOLDER = "Find a file in any folder, by name or description";

export const NO_FILES = {
  title: "No files yet",
  body: "Upload quotes, contracts and photos from vendors. Up to 10 MB each, and big PDFs are shrunk for you.",
};
export const EMPTY_FOLDER = {
  title: "This folder is empty",
  body: "Upload files into it, or make folders inside it.",
};
export const noResultsTitle = (query: string) => `No files match “${query.trim()}”`;
export const NO_RESULTS_BODY = "The search looks at every folder, by file name and description.";
export const CLEAR_SEARCH = "Clear the search";

export const FOLDERS_HEADING = "Folders";
export const FILES_HEADING = "Files";
export const NEWEST_FIRST = "newest first";

/** "12 files in all folders", or with a longer list "3.000 files in all folders, showing 200". */
export const hitsCount = (matched: number, shown: number) =>
  `${plural(matched, "file")} in all folders${matched > shown ? `, showing ${n0(shown)}` : ""}`;

// folders

export const folderSheetTitle = (renaming: boolean) => (renaming ? "Rename folder" : "New folder");
export const folderInside = (place: string) => `Inside ${place}`;
export const FOLDER_NAME_LABEL = "Name";
export const FOLDER_NAME_PLACEHOLDER = "For example, Rings";
export const FOLDER_NAME_MISSING = "Give the folder a name.";
export const folderTaken = (name: string) => `There’s already a folder called ${name.trim()} here.`;
export const FOLDER_RENAME_ACTION = "Rename";
export const FOLDER_MAKE_ACTION = "Make folder";
export const FOLDER_FAILED = "Couldn’t save the folder. What you typed is kept.";
export const madeToast = (name: string) => `Made ${name}`;
export const renamedToast = (name: string) => `Renamed to ${name}`;
export const deletedFolderToast = (name: string) => `Deleted ${name}`;

/** The notice for a folder that still holds things (guide §4.15). */
export const emptyFirst = (name: string, held: { files: number; folders: number }) => ({
  title: `Empty ${name} first`,
  body: `It still holds ${holdingsText(held)}. Move or delete them, then delete the folder.`,
});

export const deleteFolderConfirm = (name: string) => ({
  title: `Delete ${name}?`,
  body: "The folder is empty. You can undo for a few seconds.",
  action: DELETE_FOLDER,
});

// moving

export const moveTitle = (name: string) => `Move ${name}`;
export const MOVE_TO_LABEL = "Move to";
export const MOVE_HERE = "Move here";

/** Under a moved folder's title: what travels with it. */
export const moveFolderSub = (held: { files: number; folders: number }) => {
  const text = holdingsText(held);
  return text ? `With everything inside it: ${text}.` : "With everything inside it.";
};
export const moveFileSub = (place: string) => `Now in ${place}.`;
export const movedToast = (place: string) => `Moved to ${place}`;
export const DEMO_MOVE_LINE = "Demonstration mode: moving is turned off.";
export const MOVE_FAILED = "Couldn’t move it. Nothing changed.";

/** N13: Undo after the partner moved the same thing again. `where` is where it is now. */
export const movedAgainText = (partner: string, name: string, where: string | null) =>
  where
    ? `Can’t move it back: ${partner} has since moved ${name} to ${where}. It stays there.`
    : `Can’t move it back: ${partner} has since moved ${name}. It stays where it is now.`;

// a file's sheet

export const fileSheetSub = (size: number, added: string, place: string) => `${mbText(size)}, added ${added}, in ${place}`;
export const FILE_NAME_LABEL = "Name";
export const FILE_CATEGORY_LABEL = "Category";
export const FILE_CATEGORY_PLACEHOLDER = "Choose or type your own";
export const FILE_DESCRIPTION_LABEL = "Description";
export const FILE_DESCRIPTION_PLACEHOLDER = "What it is, so you can find it later";
export const OPEN_FILE = "Open";
export const DOWNLOAD_FILE = "Download";
export const DELETE_FILE = "Delete for good";

/** Delete for good (guide §5.18): permanent, so the body says so and what it frees. */
export const deleteFileConfirm = (file: Pick<FileItem, "name" | "size">) => ({
  title: `Delete ${file.name}?`,
  body: `It’s removed from storage for good, freeing ${mbText(file.size)}. It can’t be brought back.`,
  action: DELETE_FILE,
});
export const deletedFileToast = (name: string) => `Deleted ${name}`;
export const GONE_FILE = {
  title: "This file isn’t here",
  body: "It was deleted, so there’s nothing to open.",
};
