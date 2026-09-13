"use client";

import type { DocumentData } from "firebase/firestore";
import type { JSONContent } from "@tiptap/core";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type { Note } from "@/lib/types";

const COLLECTION = "notes";

const EMPTY_CONTENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function plainTextToContent(text: string): JSONContent {
  const paragraphs = text.split(/\r?\n/).map((line) => ({
    type: "paragraph",
    ...(line ? { content: [{ type: "text", text: line }] } : {}),
  }));

  return {
    type: "doc",
    content: paragraphs.length > 0 ? paragraphs : EMPTY_CONTENT.content,
  };
}

function isRichTextContent(value: unknown): value is JSONContent {
  return Boolean(value && typeof value === "object" && (value as JSONContent).type === "doc");
}

function fromDoc(id: string, data: DocumentData): Note {
  const legacyText = typeof data.text === "string" ? data.text : "";

  return {
    id,
    title: typeof data.title === "string" && data.title.trim() ? data.title : "Untitled document",
    content: isRichTextContent(data.content) ? data.content : plainTextToContent(legacyText),
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useNotes() {
  return useCollection<Note>(COLLECTION, fromDoc);
}

export function createNote() {
  return addDocument(COLLECTION, {
    title: "Untitled document",
    content: EMPTY_CONTENT,
  });
}

export function updateNote(id: string, data: Partial<Note>) {
  const { id: _id, ...rest } = data as Note;
  void _id;
  return updateDocument(COLLECTION, id, rest);
}

export function deleteNote(id: string) {
  return deleteDocument(COLLECTION, id);
}
