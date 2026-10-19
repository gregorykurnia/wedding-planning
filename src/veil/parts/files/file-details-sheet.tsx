"use client";

import { useEffect, useId, useState } from "react";
import { deleteFileForGood, setFileField, useFile, useFolders } from "@/lib/data/files";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { useToday } from "@/lib/data/use-today";
import { dateLong } from "@/lib/model/dates";
import {
  DELETE_FILE,
  DOWNLOAD_FILE,
  FILE_CATEGORY_LABEL,
  FILE_CATEGORY_PLACEHOLDER,
  FILE_DESCRIPTION_LABEL,
  FILE_DESCRIPTION_PLACEHOLDER,
  FILE_NAME_LABEL,
  MOVE,
  OPEN_FILE,
  addedOn,
  deleteFileConfirm,
  deletedFileToast,
  downloadUrl,
  fileSheetSub,
  folderTree,
  placeName,
  previewOf,
  renamedToast,
  type FileItem,
} from "@/lib/model/files";
import { FILE_CATEGORIES, extLabel } from "@/lib/model/uploads";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { FieldInput, FieldRow, Fields, FieldText } from "@/veil/parts/fields/fields";
import { SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import { useConfirm } from "@/veil/shell/confirm";
import { EditSheetActions, Sheet, useSheet, useSheets } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import styles from "./files.module.css";
import { MoveSheet } from "./move-sheet";

/**
 * A file's sheet (guide §4.20, §5.18; R10, R11, R13): a preview, then name,
 * category and description, each saved as you go (a new name toasts "Renamed to …"
 * with Undo), then Open, Download, Move and Done, and a rose "Delete for good"
 * that asks first and can't be undone. It reads the file live, so the partner's
 * edit shows in place and a file deleted meanwhile closes the sheet.
 */
export function FileDetailsSheet({ fileId }: { fileId: string }) {
  const sheet = useSheet();
  const read = useFile(fileId);

  // The last file read stays on show while the sheet closes after its deletion.
  const [kept, setKept] = useState<FileItem | null>(read.file);
  if (read.file && read.file !== kept) setKept(read.file);
  const file = read.file ?? kept;

  useEffect(() => {
    if (read.status === "gone") sheet.close();
  }, [read.status, sheet]);

  return <SaveScopeProvider sheet>{file ? <Body file={file} /> : <Sheet title="File" />}</SaveScopeProvider>;
}

function Body({ file }: { file: FileItem }) {
  const sheet = useSheet();
  const sheets = useSheets();
  const toast = useToast();
  const confirm = useConfirm();
  const today = useToday();
  const categories = useId();
  const folders = useFolders();
  const { id } = file;

  const preview = previewOf(file);
  const where = placeName(folderTree(folders.data ?? []), file.folderId);

  const name = useAutosaveField({
    value: file.name,
    required: true,
    normalize: (v: string) => v.trim(),
    save: async (next: string) => {
      const { undo, changed } = await setFileField(id, "name", next);
      if (changed) toast.undoable(renamedToast(next), undo);
    },
  });
  const category = useAutosaveField({
    value: file.category,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setFileField(id, "category", next),
  });
  const description = useAutosaveField({
    value: file.description,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setFileField(id, "description", next),
  });

  async function remove() {
    const gone = await confirm({
      ...deleteFileConfirm(file),
      danger: true,
      run: () => deleteFileForGood(id),
    });
    if (!gone) return;
    toast.confirmation(deletedFileToast(file.name));
    sheet.close();
  }

  return (
    <Sheet title={file.name} sub={fileSheetSub(file.size, dateLong(addedOn(file, today), today), where)}>
      <div className={styles.preview}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- a Cloudinary picture at preview size; the next/image loader isn't set up for them
          <img src={preview} alt="" />
        ) : (
          <span className={styles.previewExt}>{extLabel(file.name)}</span>
        )}
      </div>
      <Fields>
        <FieldRow label={FILE_NAME_LABEL} field={name}>
          <FieldInput {...name.bind} />
        </FieldRow>
        <FieldRow label={FILE_CATEGORY_LABEL} field={category}>
          <FieldInput {...category.bind} list={categories} placeholder={FILE_CATEGORY_PLACEHOLDER} />
          <datalist id={categories}>
            {FILE_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </FieldRow>
        <FieldRow label={FILE_DESCRIPTION_LABEL} field={description}>
          <FieldText {...description.bind} placeholder={FILE_DESCRIPTION_PLACEHOLDER} />
        </FieldRow>
      </Fields>
      <EditSheetActions
        before={
          <>
            <Btn variant="quiet" href={file.url} external={{}}>
              {OPEN_FILE}
            </Btn>
            <Btn variant="quiet" href={downloadUrl(file.url)} external={{ download: true }}>
              {DOWNLOAD_FILE}
            </Btn>
            <Btn variant="quiet" onClick={() => sheets.open(<MoveSheet target={{ kind: "file", id }} />)}>
              {MOVE}
            </Btn>
          </>
        }
        link={
          <TextLink tone="rose" onClick={() => void remove()}>
            {DELETE_FILE}
          </TextLink>
        }
      />
    </Sheet>
  );
}
