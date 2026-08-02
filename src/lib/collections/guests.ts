"use client";

import type { DocumentData } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type { Guest, RsvpStatus } from "@/lib/types";

const COLLECTION = "guests";

function fromDoc(id: string, data: DocumentData): Guest {
  return {
    id,
    name: data.name ?? "",
    rsvpStatus: (data.rsvpStatus as RsvpStatus) ?? "pending",
    mealChoice: data.mealChoice ?? "",
    plusOnes: typeof data.plusOnes === "number" ? data.plusOnes : 0,
    tableAssignment: data.tableAssignment ?? "",
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useGuests() {
  return useCollection<Guest>(COLLECTION, fromDoc);
}

export function createGuest() {
  return addDocument(COLLECTION, {
    name: "New Guest",
    rsvpStatus: "pending" as RsvpStatus,
    mealChoice: "",
    plusOnes: 0,
    tableAssignment: "",
  });
}

export function updateGuest(id: string, data: Partial<Guest>) {
  const { id: _id, ...rest } = data as Guest;
  void _id;
  return updateDocument(COLLECTION, id, rest);
}

export function deleteGuest(id: string) {
  return deleteDocument(COLLECTION, id);
}
