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
  Funder,
  Vendor,
  VendorCategory,
  VendorFile,
  VendorPriceOption,
} from "@/lib/types";
import {
  legacyElementId,
  mutateArray,
  updateElement,
  type Element,
} from "@/lib/data/array-ops";
import { WriteError } from "@/lib/data/write-error";
import {
  addSubEntry,
  addSubEntryFile,
  fromDocSubEntry,
  removeSubEntry,
  removeSubEntryFile,
  updateSubEntry,
} from "@/lib/confirmed-sub-entries";

const COLLECTION = "vendors";

function fromDocPriceOption(raw: unknown, index: number): VendorPriceOption | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as DocumentData;
  return {
    id: typeof data.id === "string" && data.id ? data.id : legacyElementId(index),
    description: data.description ?? "",
    price: typeof data.price === "number" ? data.price : 0,
    selected: data.selected === true,
  };
}

function fromDoc(id: string, data: DocumentData): Vendor {
  const priceOptions = Array.isArray(data.priceOptions)
    ? data.priceOptions.map((option, index) => fromDocPriceOption(option, index)).filter((o): o is VendorPriceOption => o !== null)
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
    bridestoryRating: typeof data.bridestoryRating === "number" ? data.bridestoryRating : null,
    bridestoryReviewCount:
      typeof data.bridestoryReviewCount === "number" ? data.bridestoryReviewCount : null,
    confirmedType: (data.confirmedType as ConfirmedType) ?? (data.category as VendorCategory) ?? "Other",
    funder: (data.funder as Funder) ?? null,
    totalPrice: typeof data.totalPrice === "number" ? data.totalPrice : 0,
    budgetSpent: typeof data.budgetSpent === "number" ? data.budgetSpent : 0,
    nextTargetDate: typeof data.nextTargetDate === "string" ? data.nextTargetDate : null,
    nextAction: data.nextAction ?? "",
    subEntries: Array.isArray(data.subEntries)
      ? data.subEntries
          .map((entry, index) => fromDocSubEntry(entry, (data.funder as Funder) ?? null, index))
          .filter((s): s is NonNullable<typeof s> => s !== null)
      : [],
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useVendors() {
  return useCollection<Vendor>(COLLECTION, fromDoc, [orderBy("createdAt", "desc")]);
}

export function createVendor(
  category?: VendorCategory,
  contractStatus?: ContractStatus,
  overrides?: Partial<Pick<Vendor, "name" | "bridestoryRating" | "bridestoryReviewCount">>,
) {
  return addDocument(COLLECTION, {
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
    bridestoryRating: null,
    bridestoryReviewCount: null,
    ...overrides,
    confirmedType: category ?? ("Other" as VendorCategory),
    funder: null,
    totalPrice: 0,
    budgetSpent: 0,
    nextTargetDate: null,
    nextAction: "",
    subEntries: [],
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

// Price options change through transactions on the latest stored array, so a
// partner's edit to another option is never overwritten (src/lib/data/array-ops.ts).
type StoredPriceOption = VendorPriceOption & Element;

export function addVendorPriceOption(vendor: Vendor) {
  const id = crypto.randomUUID();
  return mutateArray(COLLECTION, vendor.id, "priceOptions", (options) => {
    if (options.some((o) => o.id === id)) return { items: options, result: undefined };
    const option: VendorPriceOption = {
      id,
      description: "",
      price: 0,
      selected: options.length === 0,
    };
    return { items: [...options, option as StoredPriceOption], result: undefined };
  });
}

export function updateVendorPriceOption(
  vendor: Vendor,
  optionId: string,
  data: Partial<Pick<VendorPriceOption, "description" | "price">>,
) {
  return updateElement<StoredPriceOption>(COLLECTION, vendor.id, "priceOptions", optionId, data);
}

export function selectVendorPriceOption(vendor: Vendor, optionId: string) {
  return mutateArray(COLLECTION, vendor.id, "priceOptions", (options) => {
    if (!options.some((o) => o.id === optionId)) {
      throw new WriteError("missing", `price option ${optionId} is gone`);
    }
    return {
      items: options.map((o) => ({ ...o, selected: o.id === optionId })),
      result: undefined,
    };
  });
}

export function removeVendorPriceOption(vendor: Vendor, optionId: string) {
  return mutateArray(COLLECTION, vendor.id, "priceOptions", (options) => {
    const remaining = options.filter((o) => o.id !== optionId);
    if (remaining.length > 0 && !remaining.some((o) => o.selected === true)) {
      remaining[0] = { ...remaining[0], selected: true };
    }
    return { items: remaining, result: undefined };
  });
}

export function addVendorSubEntry(vendor: Vendor) {
  return addSubEntry(COLLECTION, vendor);
}

export function updateVendorSubEntry(
  vendor: Vendor,
  subId: string,
  data: Partial<Omit<Vendor["subEntries"][number], "id">>,
) {
  return updateSubEntry(COLLECTION, vendor, subId, data);
}

export function removeVendorSubEntry(vendor: Vendor, subId: string) {
  return removeSubEntry(COLLECTION, vendor, subId);
}

export function addVendorSubEntryFile(vendor: Vendor, subId: string, file: VendorFile) {
  return addSubEntryFile(COLLECTION, vendor, subId, file);
}

export function removeVendorSubEntryFile(vendor: Vendor, subId: string, url: string) {
  return removeSubEntryFile(COLLECTION, vendor, subId, url);
}
