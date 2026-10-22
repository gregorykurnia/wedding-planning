"use client";

import { useCallback, useEffect, useId, useRef, useState, type DragEvent } from "react";
import { useOnline } from "@/lib/data/session";
import { FIELD_FAILED, offlineOr } from "@/lib/model/save-state";
import { targetPath, type UploadQueue } from "@/lib/data/upload-queue";
import { useUploads } from "@/lib/data/uploads";
import {
  ACCEPTED_TYPES,
  DEMO_LINE,
  FILE_CATEGORIES,
  intoLine,
  statusView,
  type FileFields,
  type UploadItem,
} from "@/lib/model/uploads";
import { Sheet, SheetActions, useSheet, useSheets } from "@/veil/shell/sheet";
import { Btn } from "../actions/btn";
import { TextLink } from "../actions/text-link";
import styles from "./files.module.css";

/** Failed, refused and demonstration entries have nothing to name. */
const NAMEABLE = new Set(["shrinking", "uploading", "done"]);

function QueueEntry({
  item,
  fields,
  failed,
  categoriesId,
  queue,
}: {
  item: UploadItem;
  fields: FileFields;
  failed: boolean;
  categoriesId: string;
  queue: UploadQueue;
}) {
  const view = statusView(item);
  const offline = !useOnline();
  const leave = () => void queue.commitField(item.id);
  return (
    <li>
      <div className={styles.head}>
        <span className={styles.qname} dir="auto">
          {item.name}
        </span>
        <span className={`${styles.status} ${view.tone === "bad" ? styles.bad : view.tone === "ok" ? styles.ok : ""}`}>
          {view.text}
          {view.retry ? (
            <>
              {" "}
              <TextLink tone="rose" onClick={() => queue.retry(item.id)}>
                Try again
              </TextLink>
            </>
          ) : null}
        </span>
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
      {NAMEABLE.has(item.status) ? (
        <div className={styles.fields}>
          <input
            aria-label={`Name for ${item.name}`}
            value={fields.name}
            dir="auto"
            aria-invalid={failed || undefined}
            onChange={(e) => queue.setField(item.id, "name", e.target.value)}
            onBlur={leave}
            onKeyDown={(e) => e.key === "Enter" && leave()}
          />
          <input
            aria-label={`Category for ${item.name}`}
            list={categoriesId}
            placeholder="Category, optional"
            value={fields.category}
            aria-invalid={failed || undefined}
            onChange={(e) => queue.setField(item.id, "category", e.target.value)}
            onBlur={leave}
            onKeyDown={(e) => e.key === "Enter" && leave()}
          />
          <input
            className={styles.wide}
            aria-label={`Description for ${item.name}`}
            placeholder="Description, optional"
            value={fields.description}
            dir="auto"
            aria-invalid={failed || undefined}
            onChange={(e) => queue.setField(item.id, "description", e.target.value)}
            onBlur={leave}
            onKeyDown={(e) => e.key === "Enter" && leave()}
          />
          {failed ? (
            <div className={styles.fieldError}>
              <span>{offlineOr(FIELD_FAILED, offline)}</span>
              <TextLink tone="rose" onClick={leave}>
                Try again
              </TextLink>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** The words a screen reader hears when a file finishes or fails, since the bars change too often to announce. */
function useAnnouncement(items: UploadItem[]) {
  const seen = useRef(new Map<string, string>());
  const [text, setText] = useState("");
  useEffect(() => {
    for (const item of items) {
      const before = seen.current.get(item.id);
      if (before !== item.status && ["done", "failed", "too-large", "demo"].includes(item.status)) {
        setText(`${item.name}: ${statusView(item).text}`);
      }
      seen.current.set(item.id, item.status);
    }
  }, [items]);
  return text;
}

/**
 * The upload sheet (guide §4.20, R9, R10), shared by Files and every record:
 * a drop zone, then a queue with one entry per file, each uploading at once
 * with its own bar, name, category and description. Done only closes the sheet:
 * uploads carry on, and show on the record's tiles.
 */
export function UploadSheet({ queue }: { queue: UploadQueue }) {
  const { items, fields, fieldErrors } = useUploads(queue);
  const sheet = useSheet();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const categoriesId = useId();
  const announcement = useAnnouncement(items);
  // Closing may not blur the field being typed in (Escape, the scrim): save what changed (P3-S9).
  useEffect(() => () => void queue.commitAll(), [queue]);

  const add = (list: FileList | null) => {
    if (list && list.length) queue.add(Array.from(list));
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    add(event.dataTransfer.files);
  };

  return (
    <>
      <Sheet
        title="Upload files"
        sub={`${intoLine(targetPath(queue.place))}. PDF, Word, Excel, CSV, ZIP, text and images, up to 10 MB each. Bigger PDFs are shrunk to fit.`}
      >
        <div
          className={`${styles.zone} ${over ? styles.over : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
        >
          <b>Drop files here</b>or{" "}
          <TextLink onClick={() => input.current?.click()}>choose files</TextLink>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            accept={ACCEPTED_TYPES}
            onChange={(event) => {
              add(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
        <datalist id={categoriesId}>
          {FILE_CATEGORIES.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
        <ul className={styles.queue}>
          {items.map((item) => (
            <QueueEntry
              key={item.id}
              item={item}
              fields={fields[item.id]}
              failed={Boolean(fieldErrors[item.id])}
              categoriesId={categoriesId}
              queue={queue}
            />
          ))}
        </ul>
        <p className="sr" role="status">
          {announcement}
        </p>
        {queue.isDemo ? <p className={styles.demoLine}>{DEMO_LINE}</p> : null}
        <SheetActions>
          <Btn onClick={sheet.close}>Done</Btn>
        </SheetActions>
      </Sheet>
    </>
  );
}

/** Opens the upload sheet over the current screen, starting it clean. */
export function useUploadSheet(queue: UploadQueue): () => void {
  const sheets = useSheets();
  return useCallback(() => {
    queue.clearFinished();
    sheets.open(<UploadSheet queue={queue} />);
  }, [queue, sheets]);
}
