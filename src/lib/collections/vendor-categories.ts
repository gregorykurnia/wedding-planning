"use client";

import type { DocumentData } from "firebase/firestore";
import { orderBy } from "firebase/firestore";
import { addDocument, useCollection } from "@/lib/use-collection";

const COLLECTION = "vendorCategories";

// Built-in categories ship with the app. Categories added from the Vendors,
// Shortlist, or Confirmed pages are stored in Firestore and merged after these,
// so every page reads from one shared list.
const BUILT_IN_VENDOR_CATEGORIES = [
  "Decoration",
  "Food",
  "Groom Suit",
  "Bride Dress",
  "Invites",
  "Makeup Artist",
  "Music/DJ",
  "Photos and Videos",
  "Transportation",
  "Wedding Cake",
  "Wedding Organizer",
] as const;

// "Other" is the fallback for new rows, so it always sits last in the list.
const OTHER_VENDOR_CATEGORY = "Other";

export const DEFAULT_VENDOR_CATEGORIES = [
  ...BUILT_IN_VENDOR_CATEGORIES,
  OTHER_VENDOR_CATEGORY,
] as const;

export type DefaultVendorCategory = (typeof DEFAULT_VENDOR_CATEGORIES)[number];

// The Vendors page uses "All" as its show-everything tab, so it can't be a category.
const RESERVED_NAME = "all";
export const MAX_VENDOR_CATEGORY_LENGTH = 40;

export function isDefaultVendorCategory(name: string): name is DefaultVendorCategory {
  return (DEFAULT_VENDOR_CATEGORIES as readonly string[]).includes(name);
}

/**
 * Returns a human-readable error for an invalid new category name, or null when
 * the name can be added. Comparison is case-insensitive so "food" and "Food"
 * can't both exist.
 */
export function validateVendorCategoryName(name: string, existing: readonly string[]) {
  const trimmed = name.trim();
  if (!trimmed) return "Enter a category name.";
  if (trimmed.length > MAX_VENDOR_CATEGORY_LENGTH) {
    return `Keep it to ${MAX_VENDOR_CATEGORY_LENGTH} characters or fewer.`;
  }
  const key = trimmed.toLowerCase();
  if (key === RESERVED_NAME) return `"${trimmed}" is reserved for the All tab.`;
  if (existing.some((category) => category.toLowerCase() === key)) {
    return `"${trimmed}" is already in the list.`;
  }
  return null;
}

/**
 * Builds the shared category list: built-ins first, then custom categories in
 * the order they were added, with "Other" last. Duplicates are dropped.
 */
export function buildVendorCategories(customNames: readonly string[]): string[] {
  const seen = new Set([RESERVED_NAME, OTHER_VENDOR_CATEGORY.toLowerCase()]);
  const categories: string[] = [];
  for (const name of [...BUILT_IN_VENDOR_CATEGORIES, ...customNames]) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    categories.push(name);
  }
  return [...categories, OTHER_VENDOR_CATEGORY];
}

export interface CustomVendorCategory {
  id: string;
  name: string;
}

function fromDoc(id: string, data: DocumentData): CustomVendorCategory {
  return { id, name: typeof data.name === "string" ? data.name : "" };
}

export function useCustomVendorCategories() {
  return useCollection<CustomVendorCategory>(COLLECTION, fromDoc, [orderBy("createdAt", "asc")]);
}

export function addVendorCategory(name: string) {
  return addDocument(COLLECTION, { name: name.trim() });
}
