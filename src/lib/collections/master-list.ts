"use client";

import type { DocumentData } from "firebase/firestore";
import {
  collection,
  doc,
  orderBy,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  deleteDocument,
  setDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import type {
  MasterListItem,
  MasterListItemUpdate,
  MasterListPerson,
  MasterListType,
} from "@/lib/types";

const COLLECTION = "masterListItems";
const META_COLLECTION = "masterListMeta";
const META_ID = "initialization";

export const MASTER_LIST_TYPE_OPTIONS = [
  "Reception",
  "Matrimony",
  "Sangjit",
  "Pre-Wedding",
] as const satisfies readonly MasterListType[];

export const MASTER_LIST_PERSON_OPTIONS = [
  "General",
  "Groom",
  "Bride",
  "Groom Dad",
  "Groom Mom",
  "Groom Brother",
  "Groom Sister",
  "Bride Dad",
  "Bride Mom",
  "Bride Brothers",
] as const satisfies readonly MasterListPerson[];

type MasterListSeedRow = Pick<MasterListItem, "id" | "item" | "vendor" | "confirmed">;

/**
 * The seed IDs are intentionally stable. The initialization transaction writes
 * these rows once and the marker prevents an empty collection from being
 * interpreted as a request to recreate the list after intentional deletion.
 */
export const MASTER_LIST_INITIAL_ROWS: readonly MasterListSeedRow[] = [
  { id: "master-01-reception-venue", item: "Reception Venue", vendor: "The Langham Jakarta", confirmed: true },
  { id: "master-02-church-venue", item: "Church Venue", vendor: "GRII Karawaci", confirmed: true },
  { id: "master-03-sangjit-venue", item: "Sangjit Venue", vendor: "Pullman Jakarta", confirmed: true },
  { id: "master-04-hotel-h-1-venue", item: "Hotel H-1 Venue", vendor: "???", confirmed: false },
  { id: "master-05-wedding-organizer", item: "Wedding Organizer", vendor: "Orange Wedding Planner", confirmed: true },
  { id: "master-06-church-food-stalls", item: "Church Food Stalls", vendor: "???", confirmed: false },
  { id: "master-07-ballroom-decoration", item: "Ballroom Decoration", vendor: "Givasae/Flawless", confirmed: false },
  { id: "master-08-church-decoration", item: "Church Decoration", vendor: "Givasae", confirmed: false },
  { id: "master-09-reception-entertainment", item: "Reception Entertainment", vendor: "Kana Entertainment", confirmed: true },
  { id: "master-10-photo-and-video-wedding-day", item: "Photo and Video - Wedding Day", vendor: "Cheese n Click", confirmed: true },
  { id: "master-11-reception-and-wedding-bridal-gown", item: "Reception and Wedding Bridal Gown", vendor: "???", confirmed: false },
  { id: "master-12-groom-suit", item: "Groom Suit", vendor: "Wong Hang Tailor", confirmed: false },
  { id: "master-13-wedding-cake", item: "Wedding Cake", vendor: "???", confirmed: false },
  { id: "master-14-lighting-led", item: "Lighting LED", vendor: "CreativePro/Glowlight", confirmed: false },
  { id: "master-15-reception-mc", item: "Reception MC", vendor: "???", confirmed: false },
  { id: "master-16-printed-invitation", item: "Printed Invitation", vendor: "???", confirmed: false },
  { id: "master-17-digital-invitation-and-wedding-website", item: "Digital Invitation and Wedding Website", vendor: "Viding", confirmed: false },
  { id: "master-18-make-up-artist-bride", item: "Make Up Artist Bride", vendor: "Fannyzhu", confirmed: true },
  { id: "master-19-make-up-artist-groom-and-bride-moms", item: "Make Up Artist Groom and Bride Moms", vendor: "Sherly Kartika Team", confirmed: true },
  { id: "master-20-make-up-artist-sister", item: "Make Up Artist Sister", vendor: "Fannyzhu Team", confirmed: true },
  { id: "master-21-groom-dad-and-brothers-suit", item: "Groom Dad & Brothers Suit", vendor: "???", confirmed: false },
  { id: "master-22-groom-mom-and-sister-dress", item: "Groom Mom & Sister Dress", vendor: "???", confirmed: false },
  { id: "master-23-bride-dad-and-brothers-suit", item: "Bride Dad & Brothers Suit", vendor: "???", confirmed: false },
  { id: "master-24-bride-mom-dress", item: "Bride Mom Dress", vendor: "???", confirmed: false },
  { id: "master-25-groom-shoes", item: "Groom Shoes", vendor: "???", confirmed: false },
  { id: "master-26-souvenir-for-reception", item: "Souvenir for Reception", vendor: "???", confirmed: false },
  { id: "master-27-souvenir-for-church", item: "Souvenir for Church", vendor: "???", confirmed: false },
  { id: "master-28-sangjit-mc", item: "Sangjit MC", vendor: "Andreas Lumampaw", confirmed: true },
  { id: "master-29-photobooth", item: "Photobooth", vendor: "", confirmed: false },
  { id: "master-30-sangjit-outfit-groom", item: "Sangjit Outfit Groom", vendor: "???", confirmed: false },
  { id: "master-31-sangjit-outfit-bride", item: "Sangjit Outfit Bride", vendor: "???", confirmed: false },
  { id: "master-32-wedding-ring", item: "Wedding Ring", vendor: "Mabel's Jewels", confirmed: false },
  { id: "master-33-pre-wedding-photographer", item: "Pre Wedding Photographer", vendor: "???", confirmed: false },
  { id: "master-34-groom-parents-chinese-outfit-sangjit", item: "Groom Parents Chinese Outfit Sangjit", vendor: "???", confirmed: false },
  { id: "master-35-bride-parents-chinese-outfit-sangjit", item: "Bride Parents Chinese Outfit Sangjit", vendor: "???", confirmed: false },
  { id: "master-36-florist", item: "Florist: bouquets, corsage, boutonniere, petal", vendor: "???", confirmed: false },
  { id: "master-37-sangjit-photography", item: "Sangjit Photography", vendor: "Jason Agustian", confirmed: false },
  { id: "master-38-sangjit-videography", item: "Sangjit Videography", vendor: "Narta Agung", confirmed: false },
  { id: "master-39-transport-pickup", item: "Transport Pickup", vendor: "???", confirmed: false },
  { id: "master-40-wedding-car-decor", item: "Wedding Car Decor", vendor: "???", confirmed: false },
  { id: "master-41-civil-registration", item: "Civil Registration", vendor: "Pak Eras GRII", confirmed: false },
  { id: "master-42-bride-wedding-day-jewelry", item: "Bride Wedding Day Jewelry", vendor: "Mabel's Jewels", confirmed: false },
  { id: "master-43-bridal-accessories", item: "Bridal Accessories: veil, headpiece", vendor: "???", confirmed: false },
  { id: "master-44-bride-nails", item: "Bride Nails", vendor: "???", confirmed: false },
];

const INITIAL_ROW_COUNT = MASTER_LIST_INITIAL_ROWS.length;

export type MasterListMoveDirection = "up" | "down";

function fromDocArray<T extends string>(value: unknown, options: readonly T[]): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is T => typeof entry === "string" && options.includes(entry as T),
  );
}

function fromDoc(id: string, data: DocumentData): MasterListItem {
  return {
    id,
    item: typeof data.item === "string" ? data.item : "",
    vendor: typeof data.vendor === "string" ? data.vendor : "",
    confirmed: data.confirmed === true,
    types: fromDocArray(data.types, MASTER_LIST_TYPE_OPTIONS),
    persons: fromDocArray(data.persons, MASTER_LIST_PERSON_OPTIONS),
    next: data.next === true,
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : Number.MAX_SAFE_INTEGER,
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export function useMasterListItems() {
  return useCollection<MasterListItem>(COLLECTION, fromDoc, [orderBy("sortOrder", "asc")]);
}

/**
 * Creates the initial rows and marker in one transaction. The marker lives in
 * its own collection so deleting every row never causes the seed to return.
 */
export async function ensureMasterListInitialized() {
  const database = db;
  if (!isFirebaseConfigured || !database) return false;

  const metaRef = doc(database, META_COLLECTION, META_ID);
  await runTransaction(database, async (transaction) => {
    const marker = await transaction.get(metaRef);
    if (marker.exists()) return;

    for (const [index, row] of MASTER_LIST_INITIAL_ROWS.entries()) {
      transaction.set(doc(database, COLLECTION, row.id), {
        id: row.id,
        item: row.item,
        vendor: row.vendor,
        confirmed: row.confirmed,
        types: [],
        persons: [],
        next: false,
        sortOrder: index,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    transaction.set(metaRef, {
      initialized: true,
      nextSortOrder: INITIAL_ROW_COUNT,
      initializedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return true;
}

function newRowIds(count: number) {
  const database = db;
  if (!database) throw new Error("Firebase is not configured.");
  return Array.from({ length: count }, () => doc(collection(database, COLLECTION)).id);
}

/**
 * Appends one or more blank rows while reserving their sort positions in the
 * same transaction as the row writes. Firestore retries the transaction if a
 * second client updates the counter at the same time.
 */
export async function addMasterListItems(count = 1) {
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    throw new Error("Add between 1 and 50 rows.");
  }
  const database = db;
  if (!isFirebaseConfigured || !database) {
    throw new Error("Firebase is not configured.");
  }

  await ensureMasterListInitialized();
  const ids = newRowIds(count);
  const metaRef = doc(database, META_COLLECTION, META_ID);

  await runTransaction(database, async (transaction) => {
    const marker = await transaction.get(metaRef);
    if (!marker.exists()) {
      throw new Error("Master List initialization is incomplete. Try again.");
    }

    const markerData = marker.data();
    const startOrder =
      typeof markerData.nextSortOrder === "number"
        ? markerData.nextSortOrder
        : INITIAL_ROW_COUNT;

    ids.forEach((id, index) => {
      transaction.set(doc(database, COLLECTION, id), {
        id,
        item: "",
        vendor: "",
        confirmed: false,
        types: [],
        persons: [],
        next: false,
        sortOrder: startOrder + index,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    transaction.set(
      metaRef,
      { nextSortOrder: startOrder + count, updatedAt: serverTimestamp() },
      { merge: true },
    );
  });

  return ids;
}

export function updateMasterListItem(id: string, data: MasterListItemUpdate) {
  return updateDocument(COLLECTION, id, data as Record<string, unknown>);
}

/**
 * Swaps a row's position with its adjacent row in a transaction, verifying
 * that both positions still match the live list before writing either row.
 */
export async function moveMasterListItem(
  id: string,
  neighborId: string,
  direction: MasterListMoveDirection,
  expectedSortOrder: number,
  expectedNeighborSortOrder: number,
) {
  const database = db;
  if (!isFirebaseConfigured || !database) {
    throw new Error("Firebase is not configured.");
  }

  const itemRef = doc(database, COLLECTION, id);
  const neighborRef = doc(database, COLLECTION, neighborId);
  await runTransaction(database, async (transaction) => {
    const [itemSnapshot, neighborSnapshot] = await Promise.all([
      transaction.get(itemRef),
      transaction.get(neighborRef),
    ]);
    if (!itemSnapshot.exists() || !neighborSnapshot.exists()) return;

    const currentSortOrder = itemSnapshot.data().sortOrder;
    const neighborSortOrder = neighborSnapshot.data().sortOrder;
    if (
      typeof currentSortOrder !== "number" ||
      typeof neighborSortOrder !== "number" ||
      currentSortOrder !== expectedSortOrder ||
      neighborSortOrder !== expectedNeighborSortOrder
    ) {
      throw new Error("The list changed before this row could move. Try again.");
    }
    if (
      (direction === "up" && neighborSortOrder >= currentSortOrder) ||
      (direction === "down" && neighborSortOrder <= currentSortOrder)
    ) {
      throw new Error("The adjacent row is no longer in that direction. Try again.");
    }

    transaction.update(itemRef, {
      sortOrder: neighborSortOrder,
      updatedAt: serverTimestamp(),
    });
    transaction.update(neighborSnapshot.ref, {
      sortOrder: currentSortOrder,
      updatedAt: serverTimestamp(),
    });
  });
}

export function deleteMasterListItem(id: string) {
  return deleteDocument(COLLECTION, id);
}

export function restoreMasterListItem(item: MasterListItem) {
  return setDocument(COLLECTION, item.id, {
    id: item.id,
    item: item.item,
    vendor: item.vendor,
    confirmed: item.confirmed,
    types: item.types,
    persons: item.persons,
    next: item.next,
    sortOrder: item.sortOrder,
    createdAt: Timestamp.fromMillis(item.createdAt ?? Date.now()),
  });
}
