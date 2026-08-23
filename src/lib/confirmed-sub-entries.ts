"use client";

import type { DocumentData } from "firebase/firestore";
import { updateDocument } from "@/lib/use-collection";
import type { ConfirmedSubEntry, VendorFile } from "@/lib/types";

export function fromDocSubEntry(raw: unknown): ConfirmedSubEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as DocumentData;
  return {
    id: typeof data.id === "string" ? data.id : crypto.randomUUID(),
    name: data.name ?? "",
    totalPrice: typeof data.totalPrice === "number" ? data.totalPrice : 0,
    budgetSpent: typeof data.budgetSpent === "number" ? data.budgetSpent : 0,
    nextTargetDate: typeof data.nextTargetDate === "string" ? data.nextTargetDate : null,
    nextAction: data.nextAction ?? "",
    files: Array.isArray(data.files) ? data.files : [],
  };
}

interface HasSubEntries {
  id: string;
  subEntries: ConfirmedSubEntry[];
}

export function addSubEntry(collection: string, parent: HasSubEntries) {
  const entry: ConfirmedSubEntry = {
    id: crypto.randomUUID(),
    name: "New sub-entry",
    totalPrice: 0,
    budgetSpent: 0,
    nextTargetDate: null,
    nextAction: "",
    files: [],
  };
  return updateDocument(collection, parent.id, {
    subEntries: [...parent.subEntries, entry],
  });
}

export function updateSubEntry(
  collection: string,
  parent: HasSubEntries,
  subId: string,
  data: Partial<Omit<ConfirmedSubEntry, "id">>,
) {
  return updateDocument(collection, parent.id, {
    subEntries: parent.subEntries.map((s) => (s.id === subId ? { ...s, ...data } : s)),
  });
}

export function removeSubEntry(collection: string, parent: HasSubEntries, subId: string) {
  return updateDocument(collection, parent.id, {
    subEntries: parent.subEntries.filter((s) => s.id !== subId),
  });
}

export function addSubEntryFile(
  collection: string,
  parent: HasSubEntries,
  subId: string,
  file: VendorFile,
) {
  return updateDocument(collection, parent.id, {
    subEntries: parent.subEntries.map((s) =>
      s.id === subId ? { ...s, files: [...s.files, file] } : s,
    ),
  });
}

export function removeSubEntryFile(
  collection: string,
  parent: HasSubEntries,
  subId: string,
  url: string,
) {
  return updateDocument(collection, parent.id, {
    subEntries: parent.subEntries.map((s) =>
      s.id === subId ? { ...s, files: s.files.filter((f) => f.url !== url) } : s,
    ),
  });
}
