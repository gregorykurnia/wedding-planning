"use client";

import type { DocumentData } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type { ChecklistItem, ChecklistPhase } from "@/lib/types";

const COLLECTION = "checklistItems";

function fromDoc(id: string, data: DocumentData): ChecklistItem {
  return {
    id,
    title: data.title ?? "",
    phase: (data.phase as ChecklistPhase) ?? "12 Months Out",
    dueDate: data.dueDate ?? null,
    done: Boolean(data.done),
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useChecklistItems(workspaceId: string | null) {
  return useCollection<ChecklistItem>(workspaceId, COLLECTION, fromDoc);
}

export function createChecklistItem(workspaceId: string, phase: ChecklistPhase) {
  return addDocument(workspaceId, COLLECTION, {
    title: "New task",
    phase,
    dueDate: null,
    done: false,
  });
}

export function updateChecklistItem(
  workspaceId: string,
  id: string,
  data: Partial<ChecklistItem>,
) {
  const { id: _id, ...rest } = data as ChecklistItem;
  void _id;
  return updateDocument(workspaceId, COLLECTION, id, rest);
}

export function deleteChecklistItem(workspaceId: string, id: string) {
  return deleteDocument(workspaceId, COLLECTION, id);
}
