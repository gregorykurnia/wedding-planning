"use client";

import type { DocumentData } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type { Venue, VenueStatus } from "@/lib/types";

const COLLECTION = "venues";

function fromDoc(id: string, data: DocumentData): Venue {
  return {
    id,
    name: data.name ?? "",
    budgetEstimate: typeof data.budgetEstimate === "number" ? data.budgetEstimate : 0,
    guestMax: typeof data.guestMax === "number" ? data.guestMax : 0,
    status: (data.status as VenueStatus) ?? "Considering",
    notes: data.notes ?? "",
    images: Array.isArray(data.images) ? data.images : [],
    coverImage: data.coverImage ?? null,
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useVenues() {
  return useCollection<Venue>(COLLECTION, fromDoc);
}

export function createVenue() {
  return addDocument(COLLECTION, {
    name: "New Venue",
    budgetEstimate: 0,
    guestMax: 0,
    status: "Considering" as VenueStatus,
    notes: "",
    images: [],
    coverImage: null,
  });
}

export function updateVenue(id: string, data: Partial<Venue>) {
  const { id: _id, ...rest } = data as Venue;
  void _id;
  return updateDocument(COLLECTION, id, rest);
}

export function deleteVenue(id: string) {
  return deleteDocument(COLLECTION, id);
}

export function addVenueImage(venue: Venue, url: string) {
  const images = [...venue.images, url];
  return updateDocument(COLLECTION, venue.id, {
    images,
    coverImage: venue.coverImage ?? images[0],
  });
}
