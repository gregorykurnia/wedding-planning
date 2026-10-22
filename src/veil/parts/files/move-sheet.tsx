"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { currentPlace, moveFile, moveFolder, useFiles } from "@/lib/data/files";
import { usePartnerName } from "@/lib/data/partner";
import { useSession } from "@/lib/data/session";
import {
  DEMO_MOVE_LINE,
  MOVE_FAILED,
  MOVE_HERE,
  MOVE_TO_LABEL,
  folderGoneText,
  folderTree,
  holdings,
  moveFileSub,
  moveFolderSub,
  moveOptions,
  movedAgainText,
  movedToast,
  moveTitle,
  pathName,
  placeName,
  type Mover,
} from "@/lib/model/files";
import { WriteError } from "@/lib/data/write-error";
import { UNDO_GONE } from "@/lib/model/confirm-text";
import { Btn } from "@/veil/parts/actions/btn";
import { useFlasher } from "@/veil/shell/flash";
import { Sheet, SheetActions, useSheet } from "@/veil/shell/sheet";
import { useSheetFailure, useSheetHold } from "@/veil/shell/sheet-failure";
import { useToast } from "@/veil/shell/toasts";
import styles from "./files.module.css";
import { OfflineOr } from "@/veil/parts/fields/offline-or";

/** What the sheet moves: a file, or a folder with everything inside it. */
export type MoveTarget = { kind: "file"; id: string } | { kind: "folder"; id: string };

/**
 * N13's sentence, read when the toast shows it: the partner moved the same thing
 * again, so Undo changed nothing and says where it is now. The undo fills `where`
 * in before it rejects, and the toast host draws this after that.
 */
function MovedAgain({ partner, name, box }: { partner: string; name: string; box: { where: string | null } }) {
  return <>{movedAgainText(partner, name, box.where)}</>;
}

/** The same for an undo that finds the old folder deleted since (P5-S9); the generic line when the thing itself is gone. */
function FolderGone({ name, box }: { name: string; box: { selfGone: boolean } }) {
  return <>{box.selfGone ? UNDO_GONE : folderGoneText(name)}</>;
}

/**
 * The move sheet (guide §4.20; R11, R12): an indented tree of radio buttons, the
 * top level first. Where it already is, the folder itself and everything inside
 * it are disabled, each with its note, so a folder can't go inside itself. Move
 * here waits for a choice. It reads the tree live, so a folder the partner makes
 * or deletes shows up. Undo is offered in the toast.
 */
export function MoveSheet({ target }: { target: MoveTarget }) {
  const sheet = useSheet();
  const toast = useToast();
  const flash = useFlasher();
  const { name: partner } = usePartnerName();
  const demo = useSession().connection === "demo";
  const read = useFiles();
  const data = read.data;

  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Held while the move runs; a failure keeps it open to say so (guide §6.2, P6-S14).
  useSheetHold(busy);
  useSheetFailure(failed);
  const working = useRef(false);

  const tree = useMemo(() => folderTree(data?.folders ?? []), [data?.folders]);
  const file = target.kind === "file" ? data?.files.find((f) => f.id === target.id) : undefined;
  const folder = target.kind === "folder" ? tree.byId.get(target.id) : undefined;
  const subject = target.kind === "file" ? file : folder;
  const mover: Mover | null = file
    ? { kind: "file", folderId: file.folderId !== null && tree.byId.has(file.folderId) ? file.folderId : null }
    : folder
      ? { kind: "folder", id: folder.id, parentId: folder.parentId !== null && tree.byId.has(folder.parentId) ? folder.parentId : null }
      : null;
  const options = mover ? moveOptions(tree, mover) : [];

  if (!subject || !mover) return <Sheet title="Move" sub={read.status === "ready" ? "That isn’t here any more." : undefined} />;

  const sub: ReactNode =
    mover.kind === "folder"
      ? moveFolderSub(holdings(tree, data?.files ?? [], mover.id))
      : moveFileSub(placeName(tree, mover.folderId));

  async function move() {
    if (choice === undefined || working.current || !subject) return;
    working.current = true;
    setFailed(false);
    setBusy(true);
    const name = subject.name;
    const where = placeName(tree, choice);
    try {
      const { undo } = target.kind === "file" ? await moveFile(target.id, choice) : await moveFolder(target.id, choice);
      const box: { where: string | null; selfGone: boolean } = { where: null, selfGone: false };
      toast.undoable(
        movedToast(where),
        async () => {
          try {
            await undo();
            flash({ kind: target.kind, id: target.id });
          } catch (error) {
            if (error instanceof WriteError && error.code === "changed") {
              const names = await currentPlace(target.kind, target.id).catch(() => null);
              box.where = names ? pathName(names) : null;
            }
            if (error instanceof WriteError && error.code === "missing") {
              box.selfGone = (await currentPlace(target.kind, target.id).catch(() => [])) === null;
            }
            throw error;
          }
        },
        <MovedAgain partner={partner} name={name} box={box} />,
        undefined,
        <FolderGone name={name} box={box} />,
      );
      flash({ kind: target.kind, id: target.id });
    } catch {
      working.current = false;
      setBusy(false);
      setFailed(true);
      return;
    }
    sheet.close();
  }

  return (
    <Sheet title={moveTitle(subject.name)} sub={sub}>
      <ul className={styles.tree} role="radiogroup" aria-label={MOVE_TO_LABEL}>
        {options.map((option) => (
          <li key={option.id ?? "top"}>
            <label
              className={option.disabled ? styles.off : undefined}
              style={{ paddingInlineStart: `calc(var(--space-1) + ${option.depth} * var(--space-4))` }}
            >
              <input
                type="radio"
                name="move-to"
                value={option.id ?? ""}
                disabled={option.disabled || demo}
                checked={choice === option.id}
                onChange={() => setChoice(option.id)}
              />
              <span dir="auto">{option.name}</span>
              {option.note ? ` ${option.note}` : null}
            </label>
          </li>
        ))}
      </ul>
      {failed && (
        <p className={styles.note} role="alert">
          <OfflineOr>{MOVE_FAILED}</OfflineOr>
        </p>
      )}
      {demo && <p className={styles.demoLine}>{DEMO_MOVE_LINE}</p>}
      <SheetActions>
        <Btn variant="quiet" disabled={busy} onClick={sheet.close}>
          Cancel
        </Btn>
        <Btn
          disabled={demo || choice === undefined}
          busy={busy}
          busyLabel="Moving"
          onClick={() => void move()}
        >
          {failed ? "Try again" : MOVE_HERE}
        </Btn>
      </SheetActions>
    </Sheet>
  );
}
