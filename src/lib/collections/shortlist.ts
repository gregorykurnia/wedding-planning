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
import type { ShortlistItem, ShortlistSubEntry, Vendor, VendorCategory } from "@/lib/types";

const COLLECTION = "shortlist";

function fromDocSubEntry(raw: unknown): ShortlistSubEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as DocumentData;
  return {
    id: typeof data.id === "string" ? data.id : crypto.randomUUID(),
    name: data.name ?? "",
    type: (data.type as VendorCategory) ?? "Other",
    price: typeof data.price === "number" ? data.price : 0,
    priceDescription: data.priceDescription ?? "",
    bridestoryReviewers:
      typeof data.bridestoryReviewers === "number" ? data.bridestoryReviewers : null,
    igFollowers: typeof data.igFollowers === "number" ? data.igFollowers : null,
    nextAction: data.nextAction ?? "",
    notes: data.notes ?? "",
  };
}

function fromDoc(id: string, data: DocumentData): ShortlistItem {
  return {
    id,
    name: data.name ?? "",
    type: (data.type as VendorCategory) ?? "Other",
    contactName: data.contactName ?? "",
    contactPhone: data.contactPhone ?? "",
    price: typeof data.price === "number" ? data.price : 0,
    priceDescription: data.priceDescription ?? "",
    bridestoryReviewers:
      typeof data.bridestoryReviewers === "number" ? data.bridestoryReviewers : null,
    igFollowers: typeof data.igFollowers === "number" ? data.igFollowers : null,
    nextAction: data.nextAction ?? "",
    notes: data.notes ?? "",
    subEntries: Array.isArray(data.subEntries)
      ? data.subEntries.map(fromDocSubEntry).filter((s): s is ShortlistSubEntry => s !== null)
      : [],
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useShortlistItems() {
  return useCollection<ShortlistItem>(COLLECTION, fromDoc, [orderBy("createdAt", "desc")]);
}

export function createShortlistItem(type?: VendorCategory) {
  return addDocument(COLLECTION, {
    name: "New shortlist entry",
    type: type ?? ("Other" as VendorCategory),
    contactName: "",
    contactPhone: "",
    price: 0,
    priceDescription: "",
    bridestoryReviewers: null,
    igFollowers: null,
    nextAction: "",
    notes: "",
    subEntries: [],
  });
}

// Copies the overlapping fields from a Vendor into a brand-new, independent
// Shortlist entry — the vendor itself is left untouched. Price options don't
// map 1:1 with the Shortlist's single price/description pair, so the selected
// option (or the first one) becomes the main price, and any other price
// options are carried over as sub-entries so they aren't lost.
export function createShortlistItemFromVendor(vendor: Vendor) {
  const priceOption =
    vendor.priceOptions.find((p) => p.selected) ?? vendor.priceOptions[0] ?? null;
  const otherPriceOptions: ShortlistSubEntry[] = vendor.priceOptions
    .filter((p) => p.id !== priceOption?.id)
    .map((p) => ({
      id: crypto.randomUUID(),
      name: p.description || "Option",
      type: vendor.category,
      price: p.price,
      priceDescription: p.description,
      bridestoryReviewers: null,
      igFollowers: null,
      nextAction: "",
      notes: "",
    }));
  const subEntries: ShortlistSubEntry[] = [
    ...otherPriceOptions,
    ...vendor.subEntries.map((s) => ({
      id: crypto.randomUUID(),
      name: s.name,
      type: vendor.category,
      price: s.totalPrice,
      priceDescription: "",
      bridestoryReviewers: null,
      igFollowers: null,
      nextAction: s.nextAction,
      notes: "",
    })),
  ];
  return addDocument(COLLECTION, {
    name: vendor.name,
    type: vendor.category,
    contactName: vendor.contactName,
    contactPhone: vendor.contactPhone,
    price: priceOption?.price ?? 0,
    priceDescription: priceOption?.description ?? "",
    bridestoryReviewers: vendor.bridestoryReviewCount,
    igFollowers: null,
    nextAction: vendor.nextAction,
    notes: vendor.notes,
    subEntries,
  });
}

export function updateShortlistItem(id: string, data: Partial<ShortlistItem>) {
  const { id: _id, ...rest } = data as ShortlistItem;
  void _id;
  return updateDocument(COLLECTION, id, rest);
}

export function deleteShortlistItem(id: string) {
  return deleteDocument(COLLECTION, id);
}

export function addShortlistSubEntry(item: ShortlistItem) {
  const entry: ShortlistSubEntry = {
    id: crypto.randomUUID(),
    name: "Option",
    type: item.type,
    price: 0,
    priceDescription: "",
    bridestoryReviewers: null,
    igFollowers: null,
    nextAction: "",
    notes: "",
  };
  return updateDocument(COLLECTION, item.id, {
    subEntries: [...item.subEntries, entry],
  });
}

export function updateShortlistSubEntry(
  item: ShortlistItem,
  subId: string,
  data: Partial<Omit<ShortlistSubEntry, "id">>,
) {
  return updateDocument(COLLECTION, item.id, {
    subEntries: item.subEntries.map((s) => (s.id === subId ? { ...s, ...data } : s)),
  });
}

export function removeShortlistSubEntry(item: ShortlistItem, subId: string) {
  return updateDocument(COLLECTION, item.id, {
    subEntries: item.subEntries.filter((s) => s.id !== subId),
  });
}
