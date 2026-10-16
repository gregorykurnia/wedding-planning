"use client";

import Link from "next/link";
import type { IsoDate } from "@/lib/model/bookings";
import { dateShort } from "@/lib/model/dates";
import { extLabel } from "@/lib/model/uploads";
import { Chevron } from "@/veil/icons/chevron";
import { EnvelopeFolder } from "@/veil/icons/envelope-folder";
import { FileTypeTag } from "@/veil/icons/file-type-tag";
import { useFlash } from "@/veil/shell/flash";
import { fileMeta, fileSizeText, folderMeta, NO_TEXT } from "./ledger-text";
import styles from "./rows.module.css";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export interface FileRowData {
  id: string;
  name: string;
  /** Bytes. */
  size: number;
  /** When it was added, as `YYYY-MM-DD`. */
  date: IsoDate;
  category?: string | null;
  description?: string | null;
  /** The folders it sits in, from the top, shown in search results. */
  path?: string[];
  /** A picture's thumbnail address. Other files show their type instead. */
  thumb?: string | null;
}

export interface FileRowProps {
  file: FileRowData;
  /** Today as `YYYY-MM-DD`, so the date shows its year only when it isn't this year. */
  today: IsoDate;
  /** Search results from every folder: the meta line then names the folder. */
  withPath?: boolean;
  /** Opens the file's sheet. */
  onOpen?: (file: FileRowData) => void;
}

/**
 * A file in Files (guide §4.7): a 48px tile with the picture or the file's type,
 * the name, its size and date, and the category in gold with the description or
 * the folder under it.
 */
export function FileRow({ file, today, withPath = false, onOpen }: FileRowProps) {
  const flash = useFlash({ kind: "file", id: file.id });
  const meta = fileMeta(file, file.path ?? [], withPath);

  return (
    <li className={flash}>
      <button
        type="button"
        className={join(styles.frow, styles.linkRow)}
        data-file-id={file.id}
        onClick={() => onOpen?.(file)}
      >
        <span className={styles.ico}>
          {file.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- a thumbnail address from the upload, sized by the tile
            <img src={file.thumb} alt="" loading="lazy" />
          ) : (
            <FileTypeTag ext={extLabel(file.name)} className={styles.ext} />
          )}
        </span>
        <span className={styles.fname} dir="auto">
          {file.name}
        </span>
        <span className={styles.fside}>
          {fileSizeText(file.size)}
          <br />
          {dateShort(file.date, today)}
        </span>
        <span className={styles.fmeta} dir="auto">
          {meta.category ? <span className={styles.cat}>{meta.category}</span> : null}
          {meta.category && meta.rest ? ", " : null}
          {meta.rest || (meta.category ? null : NO_TEXT)}
        </span>
      </button>
    </li>
  );
}

export interface FolderRowProps {
  folder: { id: string; name: string; folders: number; files: number };
  /** The folder's own page. */
  href: string;
}

/** A folder in Files, drawn as an envelope, with a chevron on the right and what it holds under the name. */
export function FolderRow({ folder, href }: FolderRowProps) {
  const flash = useFlash({ kind: "folder", id: folder.id });

  return (
    <li className={flash}>
      <Link className={join(styles.frow, styles.folder, styles.linkRow)} href={href} data-folder-id={folder.id}>
        <span className={styles.ico}>
          <EnvelopeFolder />
        </span>
        <span className={styles.fname} dir="auto">
          {folder.name}
        </span>
        <span className={styles.fside}>
          <Chevron />
        </span>
        <span className={styles.fmeta}>{folderMeta(folder.folders, folder.files)}</span>
      </Link>
    </li>
  );
}
