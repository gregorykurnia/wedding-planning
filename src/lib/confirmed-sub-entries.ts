"use client";

import type { DocumentData } from "firebase/firestore";
import {
  addElement,
  legacyElementId,
  removeElement,
  updateElement,
  type Element,
} from "@/lib/data/array-ops";
import type { ConfirmedSubEntry, Funder, VendorFile } from "@/lib/types";

export function fromDocSubEntry(
  raw: unknown,
  fallbackFunder: Funder | null = null,
  index = 0,
): ConfirmedSubEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as DocumentData;
  const hasFunder = Object.prototype.hasOwnProperty.call(data, "funder");
  return {
    // Old parts saved without an id get the same id on every read (§5 #20).
    id: typeof data.id === "string" && data.id ? data.id : legacyElementId(index),
    name: data.name ?? "",
    funder:
      typeof data.funder === "string"
        ? (data.funder as Funder)
        : hasFunder
          ? null
          : fallbackFunder,
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
  funder?: Funder | null;
}

// Each change goes through a transaction that edits only the named part of the
// latest stored array, so two people editing different parts at once both keep
// their change (src/lib/data/array-ops.ts).
type StoredSubEntry = ConfirmedSubEntry & Element;

export function addSubEntry(collection: string, parent: HasSubEntries) {
  const entry: ConfirmedSubEntry = {
    id: crypto.randomUUID(),
    name: "New sub-entry",
    funder: parent.funder ?? null,
    totalPrice: 0,
    budgetSpent: 0,
    nextTargetDate: null,
    nextAction: "",
    files: [],
  };
  return addElement(collection, parent.id, "subEntries", entry as StoredSubEntry);
}

export function updateSubEntry(
  collection: string,
  parent: HasSubEntries,
  subId: string,
  data: Partial<Omit<ConfirmedSubEntry, "id">>,
) {
  return updateElement<StoredSubEntry>(collection, parent.id, "subEntries", subId, data);
}

export function removeSubEntry(collection: string, parent: HasSubEntries, subId: string) {
  return removeElement(collection, parent.id, "subEntries", subId);
}

export function addSubEntryFile(
  collection: string,
  parent: HasSubEntries,
  subId: string,
  file: VendorFile,
) {
  return updateElement<StoredSubEntry>(collection, parent.id, "subEntries", subId, (s) => ({
    ...s,
    files: [...(Array.isArray(s.files) ? s.files : []), file],
  }));
}

export function removeSubEntryFile(
  collection: string,
  parent: HasSubEntries,
  subId: string,
  url: string,
) {
  return updateElement<StoredSubEntry>(collection, parent.id, "subEntries", subId, (s) => ({
    ...s,
    files: (Array.isArray(s.files) ? s.files : []).filter((f) => f.url !== url),
  }));
}
