"use client";

import type { DocumentData } from "firebase/firestore";
import { orderBy } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type { ContractStatus, Vendor, VendorCategory, VendorFile } from "@/lib/types";

const COLLECTION = "vendors";

function fromDoc(id: string, data: DocumentData): Vendor {
  return {
    id,
    name: data.name ?? "",
    category: (data.category as VendorCategory) ?? "Other",
    contactName: data.contactName ?? "",
    contactPhone: data.contactPhone ?? "",
    contactEmail: data.contactEmail ?? "",
    contractStatus: (data.contractStatus as ContractStatus) ?? "Inquiring",
    price: typeof data.price === "number" ? data.price : 0,
    notes: data.notes ?? "",
    starred: data.starred === true,
    images: Array.isArray(data.images) ? data.images : [],
    files: Array.isArray(data.files) ? data.files : [],
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useVendors() {
  return useCollection<Vendor>(COLLECTION, fromDoc, [orderBy("createdAt", "desc")]);
}

export function createVendor(category?: VendorCategory) {
  return addDocument(COLLECTION, {
    name: "New Vendor",
    category: category ?? ("Other" as VendorCategory),
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    contractStatus: "Inquiring" as ContractStatus,
    price: 0,
    notes: "",
    starred: false,
    images: [],
    files: [],
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

export function toggleVendorStar(vendor: Vendor) {
  return updateDocument(COLLECTION, vendor.id, { starred: !vendor.starred });
}

export function addVendorImage(vendor: Vendor, url: string) {
  return updateDocument(COLLECTION, vendor.id, {
    images: [...vendor.images, url],
  });
}

export function addVendorFile(vendor: Vendor, file: VendorFile) {
  return updateDocument(COLLECTION, vendor.id, {
    files: [...vendor.files, file],
  });
}

export function removeVendorFile(vendor: Vendor, url: string) {
  return updateDocument(COLLECTION, vendor.id, {
    files: vendor.files.filter((f) => f.url !== url),
  });
}
