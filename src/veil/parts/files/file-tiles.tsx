"use client";

import type { UploadQueue } from "@/lib/data/upload-queue";
import { useUploads } from "@/lib/data/uploads";
import {
  extLabel,
  isImage,
  sizeLine,
  statusView,
  thumbUrl,
  type UploadItem,
} from "@/lib/model/uploads";
import { TextLink } from "../actions/text-link";
import styles from "./files.module.css";
import { useUploadSheet } from "./upload-sheet";

/** A file on a record, as the screen's data hook gives it. */
export interface FileTileData {
  /** The `weddingFiles` id; null for a legacy file only on the record. */
  id: string | null;
  name: string;
  url: string;
  /** Bytes, when known. Legacy files have no size. */
  size?: number | null;
  mime?: string;
  /** Shown on a finalist, a booking or a package: the vendor's file, not its own. */
  fromVendor?: boolean;
}

function Thumb({ name, mime, url }: { name: string; mime?: string; url?: string }) {
  return (
    <div className={styles.thumb}>
      {url && isImage(name, mime) ? (
        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary pictures at tile size; the next/image loader isn't set up for them
        <img src={url} alt="" loading="lazy" />
      ) : (
        <span className={styles.ext}>{extLabel(name)}</span>
      )}
    </div>
  );
}

function UploadTile({ item, onRetry }: { item: UploadItem; onRetry: () => void }) {
  const view = statusView(item, true);
  const bad = view.tone === "bad";
  return (
    <li>
      <div className={`${styles.file} ${styles.tile} ${bad ? styles.bad : ""}`}>
        <Thumb name={item.name} mime={item.mime} />
        <div className={styles.name} dir="auto">
          {item.name}
        </div>
        <div className={styles.size}>
          <span className={view.tone === "ok" ? styles.ok : undefined}>{view.text}</span>
          {view.retry ? (
            <>
              {" "}
              <TextLink tone="rose" onClick={onRetry}>
                Try again
              </TextLink>
            </>
          ) : null}
        </div>
        {view.bar ? (
          <div
            className={styles.bar}
            role="progressbar"
            aria-label={`${item.name}: ${view.text}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={view.percent ?? undefined}
          >
            <span style={{ width: `${view.percent ?? 35}%` }} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The files on a record (guide §4.20): a tile for each, tiles for uploads under
 * way or refused, and a last dashed tile that opens the upload sheet. The
 * queue is the screen's (`useUploadQueue`), so the sheet and these tiles show
 * the same uploads.
 */
export function FileTiles({
  files,
  queue,
  onOpen,
}: {
  files: readonly FileTileData[];
  queue: UploadQueue;
  /** Opens a file's details; returns false to follow the link instead. Without it a tile is a link to the file. */
  onOpen?: (file: FileTileData) => boolean;
}) {
  const { items } = useUploads(queue);
  const openSheet = useUploadSheet(queue);
  // A finished upload shows as its own tile once its document arrives; until then it keeps its "Uploaded" one.
  const present = new Set(files.map((f) => f.id));
  const shown = items.filter((item) => !(item.status === "done" && item.fileId && present.has(item.fileId)));

  return (
    <ul className={styles.files}>
      {files.map((file) => (
        <li key={file.id ?? file.url}>
          <a
            className={styles.file}
            href={file.url}
            target="_blank"
            rel="noreferrer"
            onClick={
              onOpen
                ? (event) => {
                    // A click with a modifier still opens the file in a new tab, as a link does.
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    if (onOpen(file)) event.preventDefault();
                  }
                : undefined
            }
          >
            <Thumb name={file.name} mime={file.mime} url={thumbUrl(file.url)} />
            <div className={styles.name} dir="auto">
              {file.name}
            </div>
            <div className={styles.size}>
              {file.size ? sizeLine(file.size, file.fromVendor) : file.fromVendor ? "From the vendor" : ""}
            </div>
          </a>
        </li>
      ))}
      {shown.map((item) => (
        <UploadTile key={item.id} item={item} onRetry={() => queue.retry(item.id)} />
      ))}
      <li>
        <button type="button" className={`${styles.file} ${styles.drop}`} onClick={openSheet}>
          <span>
            <b>Add files</b>Quotes, contracts, photos. Up to 10 MB each; big PDFs are shrunk for you.
          </span>
        </button>
      </li>
    </ul>
  );
}
