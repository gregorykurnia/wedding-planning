"use client";

import type { DocumentData } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type { Note } from "@/lib/types";

const COLLECTION = "notes";

function fromDoc(id: string, data: DocumentData): Note {
  return {
    id,
    text: data.text ?? "",
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useNotes(workspaceId: string | null) {
  return useCollection<Note>(workspaceId, COLLECTION, fromDoc);
}

export function createNote(workspaceId: string) {
  return addDocument(workspaceId, COLLECTION, { text: "" });
}

export function updateNote(workspaceId: string, id: string, data: Partial<Note>) {
  const { id: _id, ...rest } = data as Note;
  void _id;
  return updateDocument(workspaceId, COLLECTION, id, rest);
}

export function deleteNote(workspaceId: string, id: string) {
  return deleteDocument(workspaceId, COLLECTION, id);
}
