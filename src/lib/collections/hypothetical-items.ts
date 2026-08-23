"use client";

import { arrayRemove, arrayUnion, type DocumentData } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type { ConfirmedType, HypotheticalItem, VendorFile } from "@/lib/types";
import {
  addSubEntry,
  addSubEntryFile,
  fromDocSubEntry,
  removeSubEntry,
  removeSubEntryFile,
  updateSubEntry,
} from "@/lib/confirmed-sub-entries";

const COLLECTION = "hypotheticalItems";

function fromDoc(id: string, data: DocumentData): HypotheticalItem {
  return {
    id,
    name: data.name ?? "",
    type: (data.type as ConfirmedType) ?? "Other",
    totalPrice: typeof data.totalPrice === "number" ? data.totalPrice : 0,
    budgetSpent: typeof data.budgetSpent === "number" ? data.budgetSpent : 0,
    nextTargetDate: typeof data.nextTargetDate === "string" ? data.nextTargetDate : null,
    nextAction: data.nextAction ?? "",
    files: Array.isArray(data.files) ? data.files : [],
    subEntries: Array.isArray(data.subEntries)
      ? data.subEntries.map(fromDocSubEntry).filter((s): s is NonNullable<typeof s> => s !== null)
      : [],
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useHypotheticalItems(workspaceId: string | null) {
  return useCollection<HypotheticalItem>(workspaceId, COLLECTION, fromDoc);
}

export function createHypotheticalItem(workspaceId: string) {
  return addDocument(workspaceId, COLLECTION, {
    name: "New hypothetical",
    type: "Other" as ConfirmedType,
    totalPrice: 0,
    budgetSpent: 0,
    nextTargetDate: null,
    nextAction: "",
    files: [],
    subEntries: [],
  });
}

export function updateHypotheticalItem(
  workspaceId: string,
  id: string,
  data: Partial<HypotheticalItem>,
) {
  const { id: _id, ...rest } = data as HypotheticalItem;
  void _id;
  return updateDocument(workspaceId, COLLECTION, id, rest);
}

export function deleteHypotheticalItem(workspaceId: string, id: string) {
  return deleteDocument(workspaceId, COLLECTION, id);
}

export function addHypotheticalItemFile(
  workspaceId: string,
  item: HypotheticalItem,
  file: VendorFile,
) {
  return updateDocument(workspaceId, COLLECTION, item.id, {
    files: arrayUnion(file),
  });
}

export function removeHypotheticalItemFile(workspaceId: string, item: HypotheticalItem, url: string) {
  const file = item.files.find((f) => f.url === url);
  if (!file) return Promise.resolve();
  return updateDocument(workspaceId, COLLECTION, item.id, {
    files: arrayRemove(file),
  });
}

export function addHypotheticalItemSubEntry(workspaceId: string, item: HypotheticalItem) {
  return addSubEntry(workspaceId, COLLECTION, item);
}

export function updateHypotheticalItemSubEntry(
  workspaceId: string,
  item: HypotheticalItem,
  subId: string,
  data: Partial<Omit<HypotheticalItem["subEntries"][number], "id">>,
) {
  return updateSubEntry(workspaceId, COLLECTION, item, subId, data);
}

export function removeHypotheticalItemSubEntry(
  workspaceId: string,
  item: HypotheticalItem,
  subId: string,
) {
  return removeSubEntry(workspaceId, COLLECTION, item, subId);
}

export function addHypotheticalItemSubEntryFile(
  workspaceId: string,
  item: HypotheticalItem,
  subId: string,
  file: VendorFile,
) {
  return addSubEntryFile(workspaceId, COLLECTION, item, subId, file);
}

export function removeHypotheticalItemSubEntryFile(
  workspaceId: string,
  item: HypotheticalItem,
  subId: string,
  url: string,
) {
  return removeSubEntryFile(workspaceId, COLLECTION, item, subId, url);
}
