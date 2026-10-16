import { recordFolderPath, type RecordRef } from "./adapters/files";
import {
  baseName,
  MAX_UPLOAD_BYTES,
  newItem,
  planUpload,
  uploadReducer,
  type FileFields,
  type UploadAction,
  type UploadItem,
} from "@/lib/model/uploads";

/**
 * The upload queue (Task 3.10, R9, R10): several files at once, each with its
 * own progress, its own failure and its own Try again. It's a plain object with
 * a subscribe/snapshot pair, so the record's file tiles and the upload sheet
 * (which opens over them) read the same queue. The network and the database
 * come in as `UploadDeps`, so the rules here run in tests without either.
 */

/** Where an upload goes: a record's own folder in Files, or a folder chosen on the Files screen. */
export type UploadTarget =
  | { kind: "record"; ref: RecordRef; recordName: string; partName?: string }
  | { kind: "folder"; folderId: string | null; path: string[] };

/** The folder names from the top of Files, for "Into Files › Vendors › …". */
export const targetPath = (target: UploadTarget): string[] =>
  target.kind === "record" ? recordFolderPath(target.ref, target.recordName, target.partName) : target.path;

/** What the storage service gives back for a stored file. */
export interface UploadedAsset {
  publicId: string;
  url: string;
  resourceType: string;
  format: string;
  bytes: number;
}

export interface SaveRequest {
  /** The `weddingFiles` id: made once per file, so a retry never writes a second document. */
  docId: string;
  target: UploadTarget;
  asset: UploadedAsset;
  originalName: string;
  mime: string;
  fields: FileFields;
}

export interface UploadDeps {
  /** Shrinks a PDF toward the limit. */
  shrink(file: File): Promise<File>;
  /** Sends the file and reports bytes sent. */
  send(file: File, onProgress: (loaded: number, total: number) => void): Promise<UploadedAsset>;
  /** Files it (the folder, the `weddingFiles` document and the record's old list) and returns the document's id. */
  save(request: SaveRequest): Promise<string>;
  /** Changes the name, category and description of a document that exists. */
  rename(docId: string, originalName: string, fields: FileFields): Promise<void>;
  /** A new document id. */
  newDocId(): string;
}

export interface QueueSnapshot {
  items: UploadItem[];
  fields: Record<string, FileFields>;
  /** Files whose name, category or description couldn't be saved after the upload. */
  fieldErrors: Record<string, boolean>;
}

let counter = 0;

const sameFields = (a: FileFields, b: FileFields) =>
  a.name.trim() === b.name.trim() &&
  a.category.trim() === b.category.trim() &&
  a.description.trim() === b.description.trim();

export class UploadQueue {
  private target: UploadTarget;
  private demo: boolean;
  private deps: UploadDeps;
  private snapshot: QueueSnapshot = { items: [], fields: {}, fieldErrors: {} };
  private listeners = new Set<() => void>();
  private files = new Map<string, File>();
  private shrunk = new Map<string, File>();
  private assets = new Map<string, UploadedAsset>();
  private docIds = new Map<string, string>();
  /** Where each file goes, fixed when it's added, so moving to another folder mid-upload doesn't move it. */
  private targets = new Map<string, UploadTarget>();
  /** What the document holds, to know whether a field changed since. */
  private written = new Map<string, FileFields>();
  private shrinking: Promise<unknown> = Promise.resolve();

  constructor(target: UploadTarget, deps: UploadDeps, demo = false) {
    this.target = target;
    this.deps = deps;
    this.demo = demo;
  }

  /** The screen's current place to put files, and whether it's in demonstration mode. */
  configure(target: UploadTarget, demo: boolean) {
    this.target = target;
    this.demo = demo;
  }

  get isDemo() {
    return this.demo;
  }

  get place() {
    return this.target;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private set(next: Partial<QueueSnapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    for (const listener of [...this.listeners]) listener();
  }

  private dispatch(action: UploadAction) {
    this.set({ items: uploadReducer(this.snapshot.items, action) });
  }

  private item(id: string) {
    return this.snapshot.items.find((item) => item.id === id);
  }

  /** Puts files in the queue and starts them all. Too-large files are refused at once. */
  add(list: Iterable<File>) {
    for (const file of list) {
      const id = `u${++counter}-${Math.random().toString(36).slice(2, 7)}`;
      const item = newItem(id, file, this.demo);
      this.files.set(id, file);
      this.targets.set(id, this.target);
      this.set({
        fields: { ...this.snapshot.fields, [id]: { name: baseName(file.name), category: "", description: "" } },
        items: uploadReducer(this.snapshot.items, { type: "add", item }),
      });
      if (item.status === "shrinking" || item.status === "uploading") void this.run(id);
    }
  }

  /** Try again on a file that failed: it carries on from where it stopped (a sent file isn't sent twice). */
  retry(id: string) {
    if (this.item(id)?.status !== "failed") return;
    this.dispatch({ type: "retry", id });
    void this.run(id);
  }

  /** Reopening the sheet starts it clean: finished, refused and demo entries go; running and failed ones stay. */
  clearFinished() {
    this.dispatch({ type: "clear-finished" });
  }

  private async run(id: string) {
    const file = this.files.get(id);
    if (!file) return;
    try {
      if (!this.assets.has(id)) {
        let toSend = this.shrunk.get(id) ?? file;
        if (!this.shrunk.has(id) && planUpload(file.name, file.type, file.size) === "shrink") {
          const small = await this.shrink(file);
          if (small.size > MAX_UPLOAD_BYTES) {
            this.dispatch({ type: "too-large", id, stillOver: small.size });
            return;
          }
          this.shrunk.set(id, small);
          this.dispatch({ type: "shrunk", id, bytes: small.size });
          toSend = small;
        }
        const asset = await this.deps.send(toSend, (loaded, total) =>
          this.dispatch({ type: "progress", id, loaded, total }),
        );
        this.assets.set(id, asset);
        this.dispatch({ type: "sent", id });
      }
      let docId = this.docIds.get(id);
      if (!docId) this.docIds.set(id, (docId = this.deps.newDocId()));
      const fields = this.snapshot.fields[id];
      const fileId = await this.deps.save({
        docId,
        target: this.targets.get(id) ?? this.target,
        asset: this.assets.get(id)!,
        originalName: file.name,
        mime: file.type,
        fields,
      });
      this.written.set(id, fields);
      this.dispatch({ type: "done", id, fileId });
      // Typed while the last step ran: save that now.
      if (this.snapshot.fields[id] !== fields) void this.commitField(id);
    } catch (error) {
      console.error("Upload failed:", error);
      this.dispatch({ type: "failed", id });
    }
  }

  /** PDFs are shrunk one at a time: each rebuilds every page, which is heavy on a phone. */
  private shrink(file: File): Promise<File> {
    const next = this.shrinking.then(
      () => this.deps.shrink(file),
      () => this.deps.shrink(file),
    );
    this.shrinking = next;
    return next;
  }

  /** Typing in a field: kept as a draft, saved when the field is left (once the document exists). */
  setField(id: string, key: keyof FileFields, value: string) {
    const current = this.snapshot.fields[id];
    if (!current || current[key] === value) return;
    this.set({ fields: { ...this.snapshot.fields, [id]: { ...current, [key]: value } } });
  }

  /** Leaving a field, or Try again on its failure: a changed name, category or description is saved. */
  async commitField(id: string) {
    const item = this.item(id);
    const written = this.written.get(id);
    if (!item || item.status !== "done" || !item.fileId || !written) return;
    let fields = this.snapshot.fields[id];
    // A name can't be blank: the old one comes back.
    if (!fields.name.trim()) {
      fields = { ...fields, name: written.name };
      this.set({ fields: { ...this.snapshot.fields, [id]: fields } });
    }
    if (sameFields(fields, written)) {
      if (this.snapshot.fieldErrors[id]) this.set({ fieldErrors: { ...this.snapshot.fieldErrors, [id]: false } });
      return;
    }
    try {
      await this.deps.rename(item.fileId, item.name, fields);
      this.written.set(id, fields);
      this.set({ fieldErrors: { ...this.snapshot.fieldErrors, [id]: false } });
    } catch (error) {
      console.error("Couldn't save a file's details:", error);
      this.set({ fieldErrors: { ...this.snapshot.fieldErrors, [id]: true } });
    }
  }
}
