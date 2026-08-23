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

export function useNotes() {
  return useCollection<Note>(COLLECTION, fromDoc);
}

export function createNote() {
  return addDocument(COLLECTION, { text: "" });
}

export function updateNote(id: string, data: Partial<Note>) {
  const { id: _id, ...rest } = data as Note;
  void _id;
  return updateDocument(COLLECTION, id, rest);
}

export function deleteNote(id: string) {
  return deleteDocument(COLLECTION, id);
}
