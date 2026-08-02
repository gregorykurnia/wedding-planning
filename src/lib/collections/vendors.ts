"use client";

import type { DocumentData } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type { ContractStatus, Vendor, VendorCategory } from "@/lib/types";

const COLLECTION = "vendors";

function fromDoc(id: string, data: DocumentData): Vendor {
  return {
    id,
    name: data.name ?? "",
    category: (data.category as VendorCategory) ?? "Other",
    contactName: data.contactName ?? "",
    contactPhone: data.contactPhone ?? "",
    contactEmail: data.contactEmail ?? "",
    contractStatus: (data.contractStatus as ContractStatus) ?? "Not Contacted",
    notes: data.notes ?? "",
    images: Array.isArray(data.images) ? data.images : [],
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useVendors() {
  return useCollection<Vendor>(COLLECTION, fromDoc);
}

export function createVendor() {
  return addDocument(COLLECTION, {
    name: "New Vendor",
    category: "Other" as VendorCategory,
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    contractStatus: "Not Contacted" as ContractStatus,
    notes: "",
    images: [],
  });
}

export function updateVendor(id: string, data: Partial<Vendor>) {
  const { id: _id, ...rest } = data as Vendor;
  void _id;
  return updateDocument(COLLECTION, id, rest);
}

export function deleteVendor(id: string) {
  return deleteDocument(COLLECTION, id);
}

export function addVendorImage(vendor: Vendor, url: string) {
  return updateDocument(COLLECTION, vendor.id, {
    images: [...vendor.images, url],
  });
}
