"use client";

import type { DocumentData } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type { BudgetItem, PaymentStatus } from "@/lib/types";

const COLLECTION = "budgetItems";

function fromDoc(id: string, data: DocumentData): BudgetItem {
  return {
    id,
    category: data.category ?? "",
    estimatedAmount: typeof data.estimatedAmount === "number" ? data.estimatedAmount : 0,
    actualAmount: typeof data.actualAmount === "number" ? data.actualAmount : 0,
    paymentStatus: (data.paymentStatus as PaymentStatus) ?? "unpaid",
    notes: data.notes ?? "",
    linkedVenueId: data.linkedVenueId ?? null,
    linkedVendorId: data.linkedVendorId ?? null,
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useBudgetItems() {
  return useCollection<BudgetItem>(COLLECTION, fromDoc);
}

export function createBudgetItem() {
  return addDocument(COLLECTION, {
    category: "New Category",
    estimatedAmount: 0,
    actualAmount: 0,
    paymentStatus: "unpaid" as PaymentStatus,
    notes: "",
    linkedVenueId: null,
    linkedVendorId: null,
  });
}

/** Creates a budget line pre-filled from a booked venue, linked back to it. */
export function createBudgetItemFromVenue(venue: {
  id: string;
  name: string;
  budgetEstimate: number;
}) {
  return addDocument(COLLECTION, {
    category: `Venue — ${venue.name}`,
    estimatedAmount: venue.budgetEstimate,
    actualAmount: 0,
    paymentStatus: "unpaid" as PaymentStatus,
    notes: "",
    linkedVenueId: venue.id,
    linkedVendorId: null,
  });
}

/** Creates a budget line pre-filled from a contracted vendor, linked back to it. */
export function createBudgetItemFromVendor(vendor: { id: string; name: string; category: string }) {
  return addDocument(COLLECTION, {
    category: `${vendor.category} — ${vendor.name}`,
    estimatedAmount: 0,
    actualAmount: 0,
    paymentStatus: "unpaid" as PaymentStatus,
    notes: "",
    linkedVenueId: null,
    linkedVendorId: vendor.id,
  });
}

export function updateBudgetItem(id: string, data: Partial<BudgetItem>) {
  const { id: _id, ...rest } = data as BudgetItem;
  void _id;
  return updateDocument(COLLECTION, id, rest);
}

export function deleteBudgetItem(id: string) {
  return deleteDocument(COLLECTION, id);
}
