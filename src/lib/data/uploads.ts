"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getAuth } from "firebase/auth";
import { collection, getDocs, query, where, type Firestore } from "firebase/firestore";
import { compressPdf } from "@/lib/compress-pdf";
import { savedName, type FileFields } from "@/lib/model/uploads";
import { legacyPlace, recordRef, sameRecord, type RecordRef } from "./adapters/files";
import { isObject } from "./adapters/common";
import { addElement, mutateArray } from "./array-ops";
import { requireDb, uidOf } from "./db";
import { useSession } from "./session";
import {
  targetPath,
  UploadQueue,
  type QueueSnapshot,
  type SaveRequest,
  type UploadDeps,
  type UploadedAsset,
  type UploadTarget,
} from "./upload-queue";
import { create, newId, update, type WriteOptions } from "./write";

/**
 * The real side of the upload queue (Task 3.10): the Cloudinary request (the
 * same unsigned upload as the old UI's button), the record's folder in Files
 * (made on first use) and the `weddingFiles` document. The queue itself, which
 * decides what runs when, is `upload-queue.ts`.
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

const FOLDERS = "fileFolders";
const FILES = "weddingFiles";

/** One unsigned upload to Cloudinary. Progress comes from the request's upload events. */
export function sendToCloudinary(
  file: File,
  onProgress: (loaded: number, total: number) => void,
): Promise<UploadedAsset> {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured) {
      reject(new Error("Cloudinary isn't set up (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and _UPLOAD_PRESET)."));
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", UPLOAD_PRESET as string);
    const request = new XMLHttpRequest();
    request.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    });
    request.addEventListener("load", () => {
      try {
        const body = JSON.parse(request.responseText) as Record<string, unknown>;
        if (request.status < 200 || request.status >= 300) {
          const message = isObject(body.error) && typeof body.error.message === "string" ? body.error.message : "Upload failed";
          reject(new Error(message));
          return;
        }
        resolve({
          publicId: String(body.public_id ?? ""),
          url: String(body.secure_url ?? ""),
          resourceType: String(body.resource_type ?? "auto"),
          format: String(body.format ?? ""),
          bytes: Number(body.bytes ?? file.size),
        });
      } catch {
        reject(new Error("Upload failed"));
      }
    });
    request.addEventListener("error", () => reject(new Error("Upload failed. Check your connection.")));
    request.addEventListener("abort", () => reject(new Error("Upload cancelled")));
    request.send(form);
  });
}

type FolderDoc = { id: string; name: string; parentId: string | null; ref: RecordRef | null };

async function foldersWhere(database: Firestore, field: string, value: string | null): Promise<FolderDoc[]> {
  const snap = await getDocs(query(collection(database, FOLDERS), where(field, "==", value)));
  return snap.docs.map((d) => ({
    id: d.id,
    name: typeof d.get("name") === "string" ? (d.get("name") as string) : "",
    parentId: typeof d.get("parentId") === "string" ? (d.get("parentId") as string) : null,
    ref: recordRef(d.get("recordRef")),
  }));
}

/** Two uploads started together for the same record both need its folder; the second waits for the first to make it. */
const folderWork = new Map<string, Promise<string>>();

/**
 * The folder a record's files go in (guide §4.20): `Files › Vendors › <name>`,
 * and for a part `… › <part name>`, each made the first time it's needed. A
 * folder is found by what it belongs to (`recordRef`), not by its name, so one
 * that was moved or renamed in Files, or made by the migration, is still the one.
 */
export function recordFolder(
  ref: RecordRef,
  path: readonly string[],
  opts: WriteOptions = {},
): Promise<string> {
  const key = `${ref.kind}:${ref.id}:${ref.partId ?? ""}`;
  const running = folderWork.get(key);
  if (running) return running;
  const work = (async () => {
    const database = requireDb(opts.db);
    const make = (name: string, parentId: string | null, owner: RecordRef | null) =>
      create(FOLDERS, { name, parentId, ...(owner ? { recordRef: owner } : {}) }, opts);

    const roots = await foldersWhere(database, "parentId", null);
    const rootId = roots.find((f) => !f.ref && f.name === path[0])?.id ?? (await make(path[0], null, null));

    const ownRef: RecordRef = { kind: ref.kind, id: ref.id };
    const owned = (await foldersWhere(database, "recordRef.id", ref.id)).filter((f) => f.ref && sameRecord(f.ref, ownRef));
    const recordId = owned[0]?.id ?? (await make(path[1], rootId, ownRef));
    if (!ref.partId) return recordId;

    const parts = (await foldersWhere(database, "recordRef.id", ref.id)).filter((f) => f.ref && sameRecord(f.ref, ref));
    return parts[0]?.id ?? (await make(path[2], recordId, ref));
  })().finally(() => folderWork.delete(key));
  folderWork.set(key, work);
  return work;
}

type LegacyFile = { id: string; name: string; url: string };

/**
 * New uploads also go on the record's old `files[]` list (plan §2.7), so the
 * frozen old UI still shows them until Phase 9. The file is already in Files by
 * now, so a failure here is logged and doesn't fail the upload.
 */
async function appendToLegacyList(ref: RecordRef, file: LegacyFile, opts: WriteOptions) {
  const place = legacyPlace(ref);
  if (!place) return;
  try {
    if (place.partId) {
      await mutateArray(
        place.collection,
        place.docId,
        "subEntries",
        (items) => ({
          items: items.map((part) => {
            if (part.id !== place.partId) return part;
            const files = Array.isArray(part.files) ? (part.files as LegacyFile[]) : [];
            return files.some((f) => f.url === file.url) ? part : { ...part, files: [...files, file] };
          }),
          result: undefined,
        }),
        opts,
      );
    } else {
      await addElement(place.collection, place.docId, "files", file, opts);
    }
  } catch (error) {
    console.error("The file is in Files but not on the record's old list:", error);
  }
}

/** Files an uploaded asset: its folder, the `weddingFiles` document and the record's old list. */
export async function saveUploadedFile(request: SaveRequest, opts: WriteOptions = {}): Promise<string> {
  const { docId, target, asset, originalName, mime, fields } = request;
  const database = requireDb(opts.db);
  const folderId =
    target.kind === "record"
      ? await recordFolder(target.ref, targetPath(target), opts)
      : target.folderId;
  const name = savedName(originalName, fields.name);
  await create(
    FILES,
    {
      name,
      category: fields.category.trim(),
      description: fields.description.trim(),
      folderId,
      url: asset.url,
      publicId: asset.publicId,
      resourceType: asset.resourceType,
      originalFilename: originalName,
      fileType: mime,
      fileSize: asset.bytes,
      uploadedBy: getAuth(database.app).currentUser?.email ?? uidOf(database),
      ...(target.kind === "record" ? { recordRef: target.ref } : {}),
    },
    { ...opts, id: docId },
  );
  if (target.kind === "record") await appendToLegacyList(target.ref, { id: docId, name, url: asset.url }, opts);
  return docId;
}

/** The queue's real dependencies: Cloudinary, the PDF shrinker and the app's database. */
export function realUploadDeps(opts: WriteOptions = {}): UploadDeps {
  return {
    shrink: (file) => compressPdf(file),
    send: sendToCloudinary,
    save: (request) => saveUploadedFile(request, opts),
    rename: (docId, originalName, fields: FileFields) =>
      update(
        FILES,
        docId,
        {
          name: savedName(originalName, fields.name),
          category: fields.category.trim(),
          description: fields.description.trim(),
        },
        opts,
      ),
    newDocId: () => newId(FILES, opts),
  };
}

/**
 * The upload queue for one place to put files (a record, or a folder). It lives
 * as long as the screen does, so the record's tiles and the upload sheet read
 * the same uploads. Demonstration mode refuses every file with its own line.
 */
export function useUploadQueue(target: UploadTarget, deps?: UploadDeps): UploadQueue {
  const { connection } = useSession();
  const demo = connection === "demo";
  const [queue] = useState(() => new UploadQueue(target, deps ?? realUploadDeps(), demo));
  useEffect(() => {
    queue.configure(target, demo);
  });
  return queue;
}

/** What the queue holds right now; re-renders when it changes. */
export function useUploads(queue: UploadQueue): QueueSnapshot {
  return useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
}
