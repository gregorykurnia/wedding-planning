"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import type { FileItem, FolderItem } from "@/lib/model/files";
import { useCollection } from "@/lib/use-collection";
import { fileItemFromDoc, folderItemFromDoc } from "./adapters/files";
import { requireDb } from "./db";
import { readOf } from "./read";
import { useSession } from "./session";
import type { Loaded } from "./settings";
import { patchWithUndo, removeWithUndo, type Undoable } from "./undo";
import { create, guarded, stamp, transact, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

/**
 * Files (guide §5.18; R8–R14): every folder and file read live, folders made,
 * renamed, moved and deleted, a file's details changed and moved, each with
 * undo (guide §6.2), and deleting a file for good (R13), which has none.
 */
const FOLDERS = "fileFolders";
const FILES = "weddingFiles";

export interface FilesData {
  folders: FolderItem[];
  files: FileItem[];
}

/** Every folder, live. The tree is small, so the move sheet and the path read it whole. */
export function useFolders(): Loaded<FolderItem[]> {
  const { connection } = useSession();
  const folders = useCollection<FolderItem>(FOLDERS, folderItemFromDoc, []);
  return readOf(connection, [folders], folders.data);
}

/**
 * Every folder and every file, live (R8, R14). Files are read whole so a folder
 * opens, a search runs and a count updates with no further reads; a wedding's
 * files number in the hundreds, the screen draws them 100 or 200 at a time.
 */
export function useFiles(): Loaded<FilesData> {
  const { connection } = useSession();
  const folders = useCollection<FolderItem>(FOLDERS, folderItemFromDoc, []);
  const files = useCollection<FileItem>(FILES, fileItemFromDoc, []);
  const data = useMemo(() => ({ folders: folders.data, files: files.data }), [folders.data, files.data]);
  return readOf(connection, [folders, files], data);
}

/** Where an open file stands: `gone` is a file that was there and has been deleted since. */
export interface FileRead {
  status: "loading" | "ready" | "gone";
  file: FileItem | null;
}

/**
 * One file, live, for its sheet: edits show in place and a deleted file reads
 * `gone` so the sheet can close. A snapshot from the device's cache that says
 * "no such file" is not believed, as in `useDocument`.
 */
export function useFile(id: string): FileRead {
  const [state, setState] = useState<{ id: string; file: FileItem | null; seen: boolean; gone: boolean }>({
    id,
    file: null,
    seen: false,
    gone: false,
  });

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    return onSnapshot(
      doc(db, FILES, id),
      (snap) => {
        setState((prev) => {
          const base = prev.id === id ? prev : { id, file: null, seen: false, gone: false };
          if (snap.exists()) return { id, file: fileItemFromDoc(snap.id, snap.data()), seen: true, gone: false };
          if (base.seen && !snap.metadata.fromCache) return { ...base, file: null, gone: true };
          return base;
        });
      },
      (err) => console.error(`Error reading file ${id}:`, err),
    );
  }, [id]);

  const current = state.id === id ? state : { file: null, gone: false };
  if (current.gone) return { status: "gone", file: null };
  return current.file ? { status: "ready", file: current.file } : { status: "loading", file: null };
}

/** Deeper than any real folder tree; stops a loop in broken data from hanging. */
const MAX_DEPTH = 100;

/**
 * Puts a folder under `parentId` (or at the top with `null`) and returns where
 * it was. The new parent's ancestors are read in the same transaction as the
 * write, so a folder never ends up inside itself, even when the partner moves
 * folders at the same moment.
 */
function placeFolder(
  folderId: string,
  parentId: string | null,
  opts: WriteOptions,
  /** Undo only: the parent this move gave it. Anywhere else now, it was moved again and stays. */
  expected?: string | null,
): Promise<string | null | undefined> {
  return transact(async (tx, database) => {
    const ref = doc(database, FOLDERS, folderId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new WriteError("missing", "That folder is gone");
    let current = parentId;
    for (let depth = 0; current !== null; depth++) {
      if (current === folderId || depth > MAX_DEPTH) {
        throw new WriteError("failed", "A folder can't go inside itself");
      }
      const parent = await tx.get(doc(database, FOLDERS, current));
      if (!parent.exists()) throw new WriteError("missing", "That folder is gone");
      current = typeof parent.data().parentId === "string" ? (parent.data().parentId as string) : null;
    }
    const was = typeof snap.data().parentId === "string" ? (snap.data().parentId as string) : null;
    if (expected !== undefined && was !== expected) {
      throw new WriteError("changed", `fileFolders/${folderId} was moved after this, so undo would erase that move`);
    }
    if (was === parentId) return undefined;
    tx.update(ref, { parentId, ...stamp(database) });
    return was;
  }, opts);
}

/**
 * Moves a folder into another, or to the top with `null`. Undo moves it back,
 * unless the folder was moved again since (N13): then it refuses with `changed`.
 */
export async function moveFolder(
  folderId: string,
  parentId: string | null,
  opts: WriteOptions = {},
): Promise<Undoable> {
  const was = await placeFolder(folderId, parentId, opts);
  return {
    undo: async () => {
      if (was !== undefined) await placeFolder(folderId, was, opts, parentId);
    },
  };
}

/**
 * Puts a file in a folder (or at the top with `null`) and returns where it was.
 * The folder is read in the same transaction, so a file never lands in a folder
 * deleted meanwhile: a delete that commits first makes this retry and refuse
 * with `missing` (P4-S15).
 */
function placeFile(
  fileId: string,
  folderId: string | null,
  opts: WriteOptions,
  /** Undo only: the folder this move gave it. Anywhere else now, it was moved again and stays. */
  expected?: string | null,
): Promise<string | null | undefined> {
  return transact(async (tx, database) => {
    const ref = doc(database, FILES, fileId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new WriteError("missing", `${FILES}/${fileId} is gone`);
    if (folderId !== null && !(await tx.get(doc(database, FOLDERS, folderId))).exists()) {
      throw new WriteError("missing", "That folder is gone");
    }
    const was = typeof snap.data().folderId === "string" ? (snap.data().folderId as string) : null;
    if (expected !== undefined && was !== expected) {
      throw new WriteError("changed", `${FILES}/${fileId} was moved after this, so undo would erase that move`);
    }
    if (was === folderId) return undefined;
    tx.update(ref, { folderId, ...stamp(database) });
    return was;
  }, opts);
}

/**
 * Moves a file into a folder, or to the top with `null`. Undo moves it back,
 * unless it was moved again since (`changed`) or that folder is gone (`missing`).
 */
export async function moveFile(fileId: string, folderId: string | null, opts: WriteOptions = {}): Promise<Undoable> {
  const was = await placeFile(fileId, folderId, opts);
  // A second tap on Undo after one that worked does nothing.
  let undone = false;
  return {
    undo: async () => {
      if (was === undefined || undone) return;
      await placeFile(fileId, was, opts, folderId);
      undone = true;
    },
  };
}

/**
 * Deletes a file for good (R13, guide §6.2 "Permanent"): the server destroys
 * its stored copy and removes it from Files and from any record it was on
 * (`DELETE /api/files/[fileId]`, Task 6.3). There's no undo. Only the id is
 * sent; the server reads everything else itself. Calling it again for a file
 * that's already gone does nothing, so `retry()` after a timeout is safe.
 */
export function deleteFileForGood(
  fileId: string,
  opts: WriteOptions & { fetch?: typeof fetch } = {},
): Promise<void> {
  const database = requireDb(opts.db);
  const send = opts.fetch ?? fetch;
  return guarded(async () => {
    const user = getAuth(database.app).currentUser;
    if (!user) throw new WriteError("denied", "Not signed in");
    const token = await user.getIdToken();
    let res: Response;
    try {
      res = await send(`/api/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      throw new WriteError(offline ? "offline" : "failed", "The delete didn't reach the server", { cause: err });
    }
    if (res.ok) return;
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new WriteError(
      res.status === 401 || res.status === 403 ? "denied" : "failed",
      body?.message ?? `The server refused the delete (${res.status})`,
    );
  });
}

// ---------- folders: make, rename, delete (R8) ----------

/** Makes a folder inside `parentId` (or at the top). A retried make with the same `id` writes the same folder. */
export async function createFolder(
  name: string,
  parentId: string | null,
  opts: WriteOptions & { id?: string } = {},
): Promise<string> {
  return create(FOLDERS, { name: name.trim(), parentId }, opts);
}

/**
 * Renames a folder. Undo puts the old name back, unless the folder was renamed
 * again since, which refuses with `changed`.
 */
export function renameFolder(
  folderId: string,
  name: string,
  opts: WriteOptions = {},
): Promise<Undoable & { changed: boolean }> {
  const next = name.trim();
  return patchWithUndo(FOLDERS, folderId, (data) => (data.name === next ? null : { patch: { name: next } }), opts);
}

/**
 * Deletes an empty folder (R8). A folder that still holds a folder or a file
 * refuses, so nothing is ever left without its folder; the screen asks first and
 * explains. Undo puts the folder back with the same id and fields.
 *
 * A query can't run inside a transaction, so something can still land in the
 * folder between the check and the delete (P4-S15). It's checked again after:
 * if anything arrived, the folder is put back and the delete refuses.
 */
export async function deleteFolder(folderId: string, opts: WriteOptions = {}): Promise<Undoable> {
  const database = requireDb(opts.db);
  const holdsAnything = async () => {
    const [childFolders, childFiles] = await guarded(() =>
      Promise.all([
        getDocs(query(collection(database, FOLDERS), where("parentId", "==", folderId))),
        getDocs(query(collection(database, FILES), where("folderId", "==", folderId))),
      ]),
    );
    return !childFolders.empty || !childFiles.empty;
  };
  if (await holdsAnything()) throw new WriteError("failed", "That folder still holds things");
  const { undo } = await removeWithUndo(FOLDERS, folderId, opts);
  if (await holdsAnything()) {
    await undo();
    throw new WriteError("failed", "That folder still holds things");
  }
  return { undo };
}

// ---------- a file's details (R11) ----------

export type FileField = "name" | "category" | "description";

/**
 * Changes one field of a file, saved as you go. Undo (offered for a rename) puts
 * the old text back, unless the field was changed again since.
 */
export function setFileField(
  fileId: string,
  field: FileField,
  value: string,
  opts: WriteOptions = {},
): Promise<Undoable & { changed: boolean }> {
  const next = value.trim();
  return patchWithUndo(FILES, fileId, (data) => (data[field] === next ? null : { patch: { [field]: next } }), opts);
}

/**
 * Where a file or a folder is now, as the folder names from the top, for the
 * words of a refused undo (N13): "Can't move it back: Bella has since moved it
 * to Files › Contracts". `null` when it no longer exists.
 */
export async function currentPlace(
  kind: "file" | "folder",
  id: string,
  opts: WriteOptions = {},
): Promise<string[] | null> {
  const database = requireDb(opts.db);
  const [folders, own] = await Promise.all([
    getDocs(collection(database, FOLDERS)),
    getDoc(doc(database, kind === "file" ? FILES : FOLDERS, id)),
  ]);
  if (!own.exists()) return null;
  const parents = new Map(
    folders.docs.map((d) => [d.id, { name: String(d.get("name") ?? ""), parentId: (d.get("parentId") as string | null) ?? null }]),
  );
  let at: string | null = (own.get(kind === "file" ? "folderId" : "parentId") as string | null) ?? null;
  const names: string[] = [];
  for (let depth = 0; at && depth < 100; depth++) {
    const folder = parents.get(at);
    if (!folder) break;
    names.unshift(folder.name);
    at = folder.parentId;
  }
  return names;
}
