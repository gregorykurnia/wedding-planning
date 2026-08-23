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

export function useVenues(workspaceId: string | null) {
  return useCollection<Venue>(workspaceId, COLLECTION, fromDoc);
}

export function createVenue(workspaceId: string) {
  return addDocument(workspaceId, COLLECTION, {
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

export function updateVenue(workspaceId: string, id: string, data: Partial<Venue>) {
  const { id: _id, ...rest } = data as Venue;
  void _id;
  return updateDocument(workspaceId, COLLECTION, id, rest);
}

export function deleteVenue(workspaceId: string, id: string) {
  return deleteDocument(workspaceId, COLLECTION, id);
}

export function addVenueImage(workspaceId: string, venue: Venue, url: string) {
  return updateDocument(workspaceId, COLLECTION, venue.id, {
    images: arrayUnion(url),
    ...(venue.coverImage ? {} : { coverImage: url }),
  });
}

export function addVenueFile(workspaceId: string, venue: Venue, file: VendorFile) {
  return updateDocument(workspaceId, COLLECTION, venue.id, {
    files: arrayUnion(file),
  });
}

export function removeVenueFile(workspaceId: string, venue: Venue, url: string) {
  const file = venue.files.find((f) => f.url === url);
  if (!file) return Promise.resolve();
  return updateDocument(workspaceId, COLLECTION, venue.id, {
    files: arrayRemove(file),
  });
}

export function addVenueSubEntry(workspaceId: string, venue: Venue) {
  return addSubEntry(workspaceId, COLLECTION, venue);
}

export function updateVenueSubEntry(
  workspaceId: string,
  venue: Venue,
  subId: string,
  data: Partial<Omit<Venue["subEntries"][number], "id">>,
) {
  return updateSubEntry(workspaceId, COLLECTION, venue, subId, data);
}

export function removeVenueSubEntry(workspaceId: string, venue: Venue, subId: string) {
  return removeSubEntry(workspaceId, COLLECTION, venue, subId);
}

export function addVenueSubEntryFile(
  workspaceId: string,
  venue: Venue,
  subId: string,
  file: VendorFile,
) {
  return addSubEntryFile(workspaceId, COLLECTION, venue, subId, file);
}

export function removeVenueSubEntryFile(
  workspaceId: string,
  venue: Venue,
  subId: string,
  url: string,
) {
  return removeSubEntryFile(workspaceId, COLLECTION, venue, subId, url);
}
