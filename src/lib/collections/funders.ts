"use client";

import type { DocumentData } from "firebase/firestore";
import { orderBy } from "firebase/firestore";
import { useCollection } from "@/lib/use-collection";
import { funderFromDoc, type FunderDoc } from "@/lib/data/adapters/funders";
import { create, update, type WriteOptions } from "@/lib/data/write";

// Who pays (B11). The four old funders have their old strings as ids (seeded
// by migration 1.11), so records that store "CK" or "Bella Fam" still point at
// them; new funders get generated ids. Removing one is removeFunder in
// src/lib/data/funders.ts, because it also clears the records that use it.
const COLLECTION = "funders";

export function useFunderDocs() {
  return useCollection<FunderDoc>(
    COLLECTION,
    (id: string, data: DocumentData) => funderFromDoc(id, data),
    [orderBy("order", "asc")],
  );
}

export function addFunder(name: string, order: number, opts?: WriteOptions) {
  return create(COLLECTION, { name: name.trim(), order }, opts);
}

export function renameFunder(id: string, name: string, opts?: WriteOptions) {
  return update(COLLECTION, id, { name: name.trim() }, opts);
}
