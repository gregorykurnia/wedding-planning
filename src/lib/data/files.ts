import { doc } from "firebase/firestore";
import { patchWithUndo, type Undoable } from "./undo";
import { stamp, transact, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

/**
 * Moving files and folders in Files (R8, R12), each with undo (guide §6.2).
 */
const FOLDERS = "fileFolders";
const FILES = "weddingFiles";

/** Deeper than any real folder tree; stops a loop in broken data from hanging. */
const MAX_DEPTH = 100;

/**
 * Puts a folder under `parentId` (or at the top with `null`) and returns where
 * it was. The new parent's ancestors are read in the same transaction as the
 * write, so a folder never ends up inside itself, even when the partner moves
 * folders at the same moment.
 */
function placeFolder(folderId: string, parentId: string | null, opts: WriteOptions): Promise<string | null | undefined> {
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
    if (was === parentId) return undefined;
    tx.update(ref, { parentId, ...stamp(database) });
    return was;
  }, opts);
}

/** Moves a folder into another, or to the top with `null`. Undo moves it back. */
export async function moveFolder(
  folderId: string,
  parentId: string | null,
  opts: WriteOptions = {},
): Promise<Undoable> {
  const was = await placeFolder(folderId, parentId, opts);
  return {
    undo: async () => {
      if (was !== undefined) await placeFolder(folderId, was, opts);
    },
  };
}

/** Moves a file into a folder, or to the top with `null`. Undo moves it back. */
export function moveFile(fileId: string, folderId: string | null, opts: WriteOptions = {}): Promise<Undoable> {
  return patchWithUndo(
    FILES,
    fileId,
    (data) => ((data.folderId ?? null) === folderId ? null : { patch: { folderId } }),
    opts,
  );
}
