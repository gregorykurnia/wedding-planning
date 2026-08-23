"use client";

import type { DocumentData } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type { EventType, Guest, RsvpStatus } from "@/lib/types";

const COLLECTION = "guests";

function fromDoc(id: string, data: DocumentData): Guest {
  return {
    id,
    name: data.name ?? "",
    connection: data.connection ?? "",
    country: data.country ?? "",
    rsvpStatus: (data.rsvpStatus as RsvpStatus) ?? "pending",
    eventType: (data.eventType as EventType) ?? "Both",
    inviteSent: data.inviteSent === true,
    plusOnes: typeof data.plusOnes === "number" ? data.plusOnes : 0,
    allergies: data.allergies ?? "",
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
    connection: "",
    country: "",
    rsvpStatus: "pending" as RsvpStatus,
    eventType: "Both" as EventType,
    inviteSent: false,
    plusOnes: 0,
    allergies: "",
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
