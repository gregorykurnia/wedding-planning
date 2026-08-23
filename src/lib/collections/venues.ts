"use client";

import { arrayRemove, arrayUnion, type DocumentData } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type { ConfirmedType, Venue, VenueStatus, VendorFile } from "@/lib/types";
import {
  addSubEntry,
  addSubEntryFile,
  fromDocSubEntry,
  removeSubEntry,
  removeSubEntryFile,
  updateSubEntry,
} from "@/lib/confirmed-sub-entries";

const COLLECTION = "venues";

function fromDoc(id: string, data: DocumentData): Venue {
  return {
    id,
    name: data.name ?? "",
    budgetEstimate: typeof data.budgetEstimate === "number" ? data.budgetEstimate : 0,
    guestMax: typeof data.guestMax === "number" ? data.guestMax : 0,
    location: data.location ?? "",
    status: (data.status as VenueStatus) ?? "Shortlist",
    notes: data.notes ?? "",
    images: Array.isArray(data.images) ? data.images : [],
    coverImage: data.coverImage ?? null,
    files: Array.isArray(data.files) ? data.files : [],
    confirmedType: (data.confirmedType as ConfirmedType) ?? "Venue",
    budgetSpent: typeof data.budgetSpent === "number" ? data.budgetSpent : 0,
    nextTargetDate: typeof data.nextTargetDate === "string" ? data.nextTargetDate : null,
    nextAction: data.nextAction ?? "",
    subEntries: Array.isArray(data.subEntries)
      ? data.subEntries.map(fromDocSubEntry).filter((s): s is NonNullable<typeof s> => s !== null)
      : [],
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
    location: "",
    status: "Shortlist" as VenueStatus,
    notes: "",
    images: [],
    coverImage: null,
    files: [],
    confirmedType: "Venue" as ConfirmedType,
    budgetSpent: 0,
    nextTargetDate: null,
    nextAction: "",
    subEntries: [],
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
  return updateDocument(COLLECTION, venue.id, {
    images: arrayUnion(url),
    ...(venue.coverImage ? {} : { coverImage: url }),
  });
}

export function addVenueFile(venue: Venue, file: VendorFile) {
  return updateDocument(COLLECTION, venue.id, {
    files: arrayUnion(file),
  });
}

export function removeVenueFile(venue: Venue, url: string) {
  const file = venue.files.find((f) => f.url === url);
  if (!file) return Promise.resolve();
  return updateDocument(COLLECTION, venue.id, {
    files: arrayRemove(file),
  });
}

export function addVenueSubEntry(venue: Venue) {
  return addSubEntry(COLLECTION, venue);
}

export function updateVenueSubEntry(
  venue: Venue,
  subId: string,
  data: Partial<Omit<Venue["subEntries"][number], "id">>,
) {
  return updateSubEntry(COLLECTION, venue, subId, data);
}

export function removeVenueSubEntry(venue: Venue, subId: string) {
  return removeSubEntry(COLLECTION, venue, subId);
}

export function addVenueSubEntryFile(venue: Venue, subId: string, file: VendorFile) {
  return addSubEntryFile(COLLECTION, venue, subId, file);
}

export function removeVenueSubEntryFile(venue: Venue, subId: string, url: string) {
  return removeSubEntryFile(COLLECTION, venue, subId, url);
}
