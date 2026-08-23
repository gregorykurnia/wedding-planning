"use client";

import type { DocumentData } from "firebase/firestore";
import { arrayRemove, arrayUnion, orderBy } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type {
  ContractStatus,
  Vendor,
  VendorCategory,
  VendorFile,
  VendorPriceOption,
} from "@/lib/types";

const COLLECTION = "vendors";

function fromDocPriceOption(raw: unknown): VendorPriceOption | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as DocumentData;
  return {
    id: typeof data.id === "string" ? data.id : crypto.randomUUID(),
    description: data.description ?? "",
    price: typeof data.price === "number" ? data.price : 0,
    selected: data.selected === true,
  };
}

function fromDoc(id: string, data: DocumentData): Vendor {
  const priceOptions = Array.isArray(data.priceOptions)
    ? data.priceOptions.map(fromDocPriceOption).filter((o): o is VendorPriceOption => o !== null)
    : [];
  return {
    id,
    name: data.name ?? "",
    category: (data.category as VendorCategory) ?? "Other",
    contactName: data.contactName ?? "",
    contactPhone: data.contactPhone ?? "",
    contactEmail: data.contactEmail ?? "",
    contractStatus: (data.contractStatus as ContractStatus) ?? "Inquiring",
    priceOptions,
    notes: data.notes ?? "",
    starred: data.starred === true,
    images: Array.isArray(data.images) ? data.images : [],
    files: Array.isArray(data.files) ? data.files : [],
    totalPrice: typeof data.totalPrice === "number" ? data.totalPrice : 0,
    budgetSpent: typeof data.budgetSpent === "number" ? data.budgetSpent : 0,
    nextTargetDate: typeof data.nextTargetDate === "string" ? data.nextTargetDate : null,
    nextAction: data.nextAction ?? "",
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
    priceOptions: [
      { id: crypto.randomUUID(), description: "", price: 0, selected: true },
    ] as VendorPriceOption[],
    notes: "",
    starred: false,
    images: [],
    files: [],
    totalPrice: 0,
    budgetSpent: 0,
    nextTargetDate: null,
    nextAction: "",
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

export function addVendorFile(vendor: Vendor, file: VendorFile) {
  return updateDocument(COLLECTION, vendor.id, {
    files: arrayUnion(file),
  });
}

export function removeVendorFile(vendor: Vendor, url: string) {
  const file = vendor.files.find((f) => f.url === url);
  if (!file) return Promise.resolve();
  return updateDocument(COLLECTION, vendor.id, {
    files: arrayRemove(file),
  });
}

export function addVendorPriceOption(vendor: Vendor) {
  const option: VendorPriceOption = {
    id: crypto.randomUUID(),
    description: "",
    price: 0,
    selected: vendor.priceOptions.length === 0,
  };
  return updateDocument(COLLECTION, vendor.id, {
    priceOptions: [...vendor.priceOptions, option],
  });
}

export function updateVendorPriceOption(
  vendor: Vendor,
  optionId: string,
  data: Partial<Pick<VendorPriceOption, "description" | "price">>,
) {
  return updateDocument(COLLECTION, vendor.id, {
    priceOptions: vendor.priceOptions.map((o) =>
      o.id === optionId ? { ...o, ...data } : o,
    ),
  });
}

export function selectVendorPriceOption(vendor: Vendor, optionId: string) {
  return updateDocument(COLLECTION, vendor.id, {
    priceOptions: vendor.priceOptions.map((o) => ({
      ...o,
      selected: o.id === optionId,
    })),
  });
}

export function removeVendorPriceOption(vendor: Vendor, optionId: string) {
  const remaining = vendor.priceOptions.filter((o) => o.id !== optionId);
  if (remaining.length > 0 && !remaining.some((o) => o.selected)) {
    remaining[0] = { ...remaining[0], selected: true };
  }
  return updateDocument(COLLECTION, vendor.id, { priceOptions: remaining });
}
