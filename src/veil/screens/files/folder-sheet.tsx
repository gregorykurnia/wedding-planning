"use client";

import { useRef, useState } from "react";
import { createFolder, renameFolder, useFolders } from "@/lib/data/files";
import { newId } from "@/lib/data/write";
import {
  FOLDER_FAILED,
  FOLDER_MAKE_ACTION,
  FOLDER_NAME_LABEL,
  FOLDER_NAME_MISSING,
  FOLDER_NAME_PLACEHOLDER,
  FOLDER_RENAME_ACTION,
  folderInside,
  folderSheetTitle,
  folderTaken,
  folderTree,
  madeToast,
  nameTaken,
  placeName,
  renamedToast,
} from "@/lib/model/files";
import { FieldInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { Banner } from "@/veil/shell/banner";
import { useFlasher } from "@/veil/shell/flash";
import { CreateSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";

/**
 * "New folder" and "Rename folder" (guide §5.18; R8): one name field, and Enter
 * does what the button does. A name a sibling already has is refused, ignoring
 * case. A new folder's id is made on the first press and kept, so Try again after
 * a lost connection never makes two. A rename offers Undo; a new folder flashes.
 */
export function FolderSheet({ parentId, folder }: { parentId: string | null; folder?: { id: string; name: string } }) {
  const sheet = useSheet();
  const toast = useToast();
  const flash = useFlasher();
  const folders = useFolders();
  const tree = folderTree(folders.data ?? []);
  const renaming = Boolean(folder);

  const [name, setName] = useState(folder?.name ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = useRef<string | null>(folder?.id ?? null);
  const input = useRef<HTMLInputElement>(null);

  async function save() {
    if (busy) return;
    const next = name.trim();
    if (!next) {
      setProblem(FOLDER_NAME_MISSING);
      input.current?.focus();
      return;
    }
    if (nameTaken(tree, parentId, next, folder?.id)) {
      setProblem(folderTaken(next));
      input.current?.focus();
      return;
    }
    setFailed(false);
    setBusy(true);
    try {
      if (folder) {
        const { undo, changed } = await renameFolder(folder.id, next);
        if (changed) toast.undoable(renamedToast(next), undo);
      } else {
        id.current ??= newId("fileFolders");
        await createFolder(next, parentId, { id: id.current });
        toast.confirmation(madeToast(next));
        flash({ kind: "folder", id: id.current });
      }
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    sheet.close();
  }

  return (
    <Sheet
      title={folderSheetTitle(renaming)}
      sub={renaming ? undefined : folderInside(placeName(tree, parentId))}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Fields>
          <FieldRow label={FOLDER_NAME_LABEL} problem={problem}>
            <FieldInput
              ref={input}
              autoFocus
              placeholder={FOLDER_NAME_PLACEHOLDER}
              value={name}
              onChange={(next) => {
                setName(next);
                setProblem(null);
              }}
            />
          </FieldRow>
        </Fields>
      </form>
      {failed && (
        <Banner tone="rose" inline>
          {FOLDER_FAILED}
        </Banner>
      )}
      <CreateSheetActions
        action={failed ? "Try again" : renaming ? FOLDER_RENAME_ACTION : FOLDER_MAKE_ACTION}
        busy={busy}
        busyLabel={renaming ? "Renaming" : "Making"}
        demoLine={`Demonstration mode: ${renaming ? "renaming" : "adding"} is turned off.`}
        onAction={() => void save()}
      />
    </Sheet>
  );
}
