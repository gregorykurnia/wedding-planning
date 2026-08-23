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
  ConfirmedType,
  ContractStatus,
  Vendor,
  VendorCategory,
  VendorFile,
  VendorPriceOption,
} from "@/lib/types";
import {
  addSubEntry,
  addSubEntryFile,
  fromDocSubEntry,
  removeSubEntry,
  removeSubEntryFile,
  updateSubEntry,
} from "@/lib/confirmed-sub-entries";

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
    confirmedType: (data.confirmedType as ConfirmedType) ?? (data.category as VendorCategory) ?? "Other",
    totalPrice: typeof data.totalPrice === "number" ? data.totalPrice : 0,
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

export function useVendors(workspaceId: string | null) {
  return useCollection<Vendor>(workspaceId, COLLECTION, fromDoc, [orderBy("createdAt", "desc")]);
}

export function createVendor(
  workspaceId: string,
  category?: VendorCategory,
  contractStatus?: ContractStatus,
) {
  return addDocument(workspaceId, COLLECTION, {
    name: "New Vendor",
    category: category ?? ("Other" as VendorCategory),
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    contractStatus: contractStatus ?? ("Inquiring" as ContractStatus),
    priceOptions: [
      { id: crypto.randomUUID(), description: "", price: 0, selected: true },
    ] as VendorPriceOption[],
    notes: "",
    starred: false,
    images: [],
    files: [],
    confirmedType: category ?? ("Other" as VendorCategory),
    totalPrice: 0,
    budgetSpent: 0,
    nextTargetDate: null,
    nextAction: "",
    subEntries: [],
  });
}

export function updateVendor(workspaceId: string, id: string, data: Partial<Vendor>) {
  const { id: _id, ...rest } = data as Vendor;
  void _id;
  return updateDocument(workspaceId, COLLECTION, id, rest);
}

export function deleteVendor(workspaceId: string, id: string) {
  return deleteDocument(workspaceId, COLLECTION, id);
}

export function toggleVendorStar(workspaceId: string, vendor: Vendor) {
  return updateDocument(workspaceId, COLLECTION, vendor.id, { starred: !vendor.starred });
}

export function addVendorFile(workspaceId: string, vendor: Vendor, file: VendorFile) {
  return updateDocument(workspaceId, COLLECTION, vendor.id, {
    files: arrayUnion(file),
  });
}

export function removeVendorFile(workspaceId: string, vendor: Vendor, url: string) {
  const file = vendor.files.find((f) => f.url === url);
  if (!file) return Promise.resolve();
  return updateDocument(workspaceId, COLLECTION, vendor.id, {
    files: arrayRemove(file),
  });
}

export function addVendorPriceOption(workspaceId: string, vendor: Vendor) {
  const option: VendorPriceOption = {
    id: crypto.randomUUID(),
    description: "",
    price: 0,
    selected: vendor.priceOptions.length === 0,
  };
  return updateDocument(workspaceId, COLLECTION, vendor.id, {
    priceOptions: [...vendor.priceOptions, option],
  });
}

export function updateVendorPriceOption(
  workspaceId: string,
  vendor: Vendor,
  optionId: string,
  data: Partial<Pick<VendorPriceOption, "description" | "price">>,
) {
  return updateDocument(workspaceId, COLLECTION, vendor.id, {
    priceOptions: vendor.priceOptions.map((o) =>
      o.id === optionId ? { ...o, ...data } : o,
    ),
  });
}

export function selectVendorPriceOption(workspaceId: string, vendor: Vendor, optionId: string) {
  return updateDocument(workspaceId, COLLECTION, vendor.id, {
    priceOptions: vendor.priceOptions.map((o) => ({
      ...o,
      selected: o.id === optionId,
    })),
  });
}

export function removeVendorPriceOption(workspaceId: string, vendor: Vendor, optionId: string) {
  const remaining = vendor.priceOptions.filter((o) => o.id !== optionId);
  if (remaining.length > 0 && !remaining.some((o) => o.selected)) {
    remaining[0] = { ...remaining[0], selected: true };
  }
  return updateDocument(workspaceId, COLLECTION, vendor.id, { priceOptions: remaining });
}

export function addVendorSubEntry(workspaceId: string, vendor: Vendor) {
  return addSubEntry(workspaceId, COLLECTION, vendor);
}

export function updateVendorSubEntry(
  workspaceId: string,
  vendor: Vendor,
  subId: string,
  data: Partial<Omit<Vendor["subEntries"][number], "id">>,
) {
  return updateSubEntry(workspaceId, COLLECTION, vendor, subId, data);
}

export function removeVendorSubEntry(workspaceId: string, vendor: Vendor, subId: string) {
  return removeSubEntry(workspaceId, COLLECTION, vendor, subId);
}

export function addVendorSubEntryFile(
  workspaceId: string,
  vendor: Vendor,
  subId: string,
  file: VendorFile,
) {
  return addSubEntryFile(workspaceId, COLLECTION, vendor, subId, file);
}

export function removeVendorSubEntryFile(
  workspaceId: string,
  vendor: Vendor,
  subId: string,
  url: string,
) {
  return removeSubEntryFile(workspaceId, COLLECTION, vendor, subId, url);
}
