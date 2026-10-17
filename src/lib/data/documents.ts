"use client";

import { useEffect, useState } from "react";
import { deleteField, doc, onSnapshot } from "firebase/firestore";
import type { JSONContent } from "@tiptap/core";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { titleOrUntitled } from "@/lib/model/documents";
import { logActivity } from "./activity";
import { documentFromDoc, contentFields, type DocumentDoc } from "./adapters/documents";
import { useRemovedByPartner } from "./partner";
import { useSession } from "./session";
import type { ReadStatus } from "./settings";
import { create, remove, update, type WriteOptions } from "./write";

export type { DocumentDoc } from "./adapters/documents";

const COLLECTION = "notes";

/**
 * Where an open document stands. Besides the usual read statuses (plan §2.7):
 * - `missing`: there is no such document, and never was while this screen was
 *   open (an old link: "This document isn't here", N2);
 * - `gone`: it was there and has been deleted since (guide §5.17). `by` is the
 *   partner's name when the partner deleted it, or null.
 */
export type DocumentStatus = ReadStatus | "missing" | "gone";

export interface DocumentRead {
  status: DocumentStatus;
  data: DocumentDoc | null;
  /** True while the latest snapshot holds a write of ours the server hasn't confirmed. */
  pending: boolean;
  by: string | null;
}

/**
 * One document, live. `id` null is a document that doesn't exist yet (a new
 * one before its first save), which reads as ready with no data.
 *
 * A snapshot from the device's cache that says "no such document" is not
 * believed: with nothing cached, that's what an offline first read says, and
 * it must not turn into "This document isn't here".
 */
export function useDocument(id: string | null): DocumentRead {
  const { connection } = useSession();
  const [state, setState] = useState<{
    id: string | null;
    data: DocumentDoc | null;
    seen: boolean;
    status: "loading" | "ready" | "missing" | "gone" | "error";
    pending: boolean;
  }>({ id, data: null, seen: false, status: "loading", pending: false });
  const removed = useRemovedByPartner({ kind: "document", id: id ?? "" });

  useEffect(() => {
    if (!id || !isFirebaseConfigured || !db) return;
    const unsubscribe = onSnapshot(
      doc(db, COLLECTION, id),
      { includeMetadataChanges: true },
      (snap) => {
        setState((prev) => {
          const base = prev.id === id ? prev : { id, data: null, seen: false, status: "loading" as const, pending: false };
          if (snap.exists()) {
            return {
              id,
              data: documentFromDoc(snap.id, snap.data()),
              seen: true,
              status: "ready",
              pending: snap.metadata.hasPendingWrites,
            };
          }
          if (base.seen) return { ...base, status: "gone", pending: false };
          if (snap.metadata.fromCache) return base;
          return { ...base, status: "missing", pending: false };
        });
      },
      (err) => {
        console.error(`Error reading document ${id}:`, err);
        setState((prev) => ({ ...prev, id, status: "error" }));
      },
    );
    return () => unsubscribe();
  }, [id]);

  if (connection === "demo") return { status: "demo", data: null, pending: false, by: null };
  if (!id) return { status: "ready", data: null, pending: false, by: null };
  const current = state.id === id ? state : { data: null, status: "loading" as const, pending: false };
  const by = removed?.by ?? null;
  if (current.status === "gone" || current.status === "missing") {
    return { status: current.status, data: null, pending: false, by };
  }
  const { data, pending } = current;
  if (current.status === "error") return { status: "error", data, pending, by };
  if (connection === "offline" && data) return { status: "offline", data, pending, by };
  if (current.status === "loading") {
    return { status: connection === "offline" ? "offline" : "loading", data: null, pending, by };
  }
  return { status: "ready", data, pending, by };
}

export interface DocumentDraft {
  title: string;
  content: JSONContent;
}

/** Drops `undefined` (Firestore refuses it) and makes a plain copy of the editor's JSON. */
const plain = (content: JSONContent): JSONContent => JSON.parse(JSON.stringify(content)) as JSONContent;

/**
 * Saves the whole draft, title and content, as the old editor did: the later
 * save wins (plan §9.2 Q7). `created` false makes the document with this id
 * first; a retried create writes the same id again, so it never makes two.
 */
export async function saveDocument(
  id: string,
  draft: DocumentDraft,
  { created, ...opts }: WriteOptions & { created: boolean },
): Promise<void> {
  const content = plain(draft.content);
  if (created) {
    await update(COLLECTION, id, { title: draft.title, ...contentFields(content, deleteField()) }, opts);
    return;
  }
  // A new document has no fallback fields to remove, so they are simply left out.
  const fields = Object.fromEntries(
    Object.entries(contentFields(content, undefined)).filter(([, v]) => v !== undefined),
  );
  await create(COLLECTION, { title: draft.title, ...fields }, { ...opts, id });
  void logActivity("document.added", { name: titleOrUntitled(draft.title) }, { kind: "document", id }, opts);
}

/** Deletes a document for good (guide §6.2, R7). There is no undo. */
export async function deleteDocumentForGood(id: string, title: string, opts: WriteOptions = {}): Promise<void> {
  await remove(COLLECTION, id, opts);
  void logActivity("document.deleted", { name: titleOrUntitled(title) }, { kind: "document", id }, opts);
}
