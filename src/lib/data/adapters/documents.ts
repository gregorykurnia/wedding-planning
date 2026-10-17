import type { DocumentData } from "firebase/firestore";
import type { JSONContent } from "@tiptap/core";
import {
  FIRESTORE_MAX_DEPTH,
  docLines,
  docTitleOf,
  fingerprint,
  nestingDepth,
  normaliseDoc,
  plainTextDoc,
  stableKey,
} from "@/lib/model/documents";
import { millis, str, strOrNull } from "./common";

/** A document (`notes`) as the editor reads it. */
export interface DocumentDoc {
  id: string;
  title: string;
  /** Normalised (fonts and sizes mapped), ready for the editor. */
  content: JSONContent;
  createdAt: number | null;
  updatedAt: number | null;
  /** The account that saved it last, or null when the old UI did (it doesn't stamp one). */
  updatedBy: string | null;
}

/**
 * Reads a stored document. `content` is Tiptap JSON; a note from before rich
 * text has only `text`. A document too deeply nested for a Firestore map is
 * kept whole in `contentJson`, beside a plain copy in `content` for the old
 * UI; `contentFor` fingerprints that copy, so once the old UI has saved over
 * it, its newer `content` wins.
 */
export function documentFromDoc(id: string, data: DocumentData): DocumentDoc {
  return {
    id,
    title: docTitleOf(data.title),
    content: normaliseDoc(storedContent(data)),
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
    updatedBy: strOrNull(data.updatedBy),
  };
}

function storedContent(data: DocumentData): unknown {
  const whole = str(data.contentJson);
  if (whole && str(data.contentFor) === fingerprint(stableKey(data.content ?? null))) {
    try {
      return JSON.parse(whole);
    } catch {
      // A damaged copy: fall back to what the old UI reads.
    }
  }
  if (data.content && typeof data.content === "object" && (data.content as JSONContent).type === "doc") {
    return data.content;
  }
  return plainTextDoc(str(data.text));
}

/**
 * The fields to store for a document's content. Normally the Tiptap JSON as
 * the old UI stores it. When it nests deeper than Firestore allows, the whole
 * document goes in `contentJson` and `content` holds its text, line by line.
 * `remove` is the value that deletes a field (Firestore's `deleteField()`).
 */
export function contentFields(content: JSONContent, remove: unknown): Record<string, unknown> {
  // Firestore counts the field's own map as the first level (tests/data/documents.test.ts).
  if (nestingDepth(content) <= FIRESTORE_MAX_DEPTH) {
    return { content, contentJson: remove, contentFor: remove };
  }
  const plain = plainTextDoc(docLines(content).join("\n"));
  return { content: plain, contentJson: JSON.stringify(content), contentFor: fingerprint(stableKey(plain)) };
}
