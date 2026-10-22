"use client";

import { useMemo } from "react";
import { collection, deleteField, doc, getDocs, limit, query, where } from "firebase/firestore";
import { useCollection } from "@/lib/use-collection";
import type { IsoDate } from "@/lib/model/bookings";
import { isVendorBooked } from "@/lib/model/bookings";
import { finalistDetail, type FinalistDetail, type FinalistFile } from "@/lib/model/finalist-detail";
import { isListedVendor } from "@/lib/model/search";
import { finalistListItem, isPackage, type FinalistListItem } from "@/lib/model/shortlist";
import { logActivity } from "./activity";
import { withElementIds, mutateArray, type Element } from "./array-ops";
import { bookingMark, vendorFromDoc, type VendorDoc } from "./adapters/bookings";
import { num } from "./adapters/common";
import { fileFromDoc, filesForRecord, type FileDoc, type RecordRef } from "./adapters/files";
import { finalistBookingId, finalistBookingVendorId, finalistFromDoc, MAIN_PACKAGE_ID, type FinalistDoc, type Package } from "./adapters/shortlist";
import { requireDb } from "./db";
import { mergeStatus, readOf } from "./read";
import { useSession } from "./session";
import type { Loaded } from "./settings";
import { patchWithUndo, removeElementWithUndo, removeWithUndo, type Undoable } from "./undo";
import { create, newId, stamp, transact, update, type WriteOptions } from "./write";
import { WriteError } from "./write-error";
import { useCategories, type CategoriesData } from "./vendors";

/**
 * Shortlist writes (guide §5.12–§5.14, F17–F21, F24). A finalist copied from a
 * vendor keeps `sourceVendorId`, so the vendor's files show on it without
 * being copied (F20). Booking a finalist or moving it into Vendors records
 * where it went in `movedTo`.
 */
const SHORTLIST = "shortlist";
const VENDORS = "vendors";

const makeId = () => crypto.randomUUID();

/** The shortlist (guide §5.13): every finalist as its card reads it. */
export function useFinalists(): Loaded<FinalistListItem[]> {
  const { connection } = useSession();
  // No ordering: a document without `createdAt` must not drop out of the list.
  const finalists = useCollection<FinalistDoc>(SHORTLIST, finalistFromDoc, []);
  const vendors = useCollection<VendorDoc>(VENDORS, vendorFromDoc, []);
  const items = useMemo(() => {
    const byId = new Map(vendors.data.map((v) => [v.id, v]));
    return finalists.data.map((f) => finalistListItem({ ...f, bookingId: finalistBookingId(f, byId) }));
  }, [finalists.data, vendors.data]);
  return readOf(connection, [finalists, vendors], items, 1);
}

/** The finalists and the category list as one read, for the screen and its add sheet. */
export function useFinalistsAndCategories(): Loaded<[FinalistListItem[], CategoriesData]> {
  const finalists = useFinalists();
  const categories = useCategories();
  const status = mergeStatus(finalists, categories);
  const data = useMemo<[FinalistListItem[], CategoriesData] | null>(
    () => (finalists.data && categories.data ? [finalists.data, categories.data] : null),
    [finalists.data, categories.data],
  );
  return { status, data: status === "demo" ? null : data };
}

export interface NewFinalist {
  /** Made when the sheet's form began, so Try again writes the same record. */
  id: string;
  name: string;
  category: string;
  /** The first package's name and price; either may be left out, and with both left out there is no package yet. */
  packageName: string;
  price: number | null;
}

/** Stops an undo of an add from deleting a finalist that has grown since (a package, a note, a file, a booking). */
function untouched(data: Record<string, unknown>) {
  const filled = (v: unknown) => (Array.isArray(v) && v.length > 0) || (typeof v === "string" && v.trim() !== "");
  if (data.movedTo || filled(data.subEntries) || filled(data.files) || filled(data.notes)) {
    throw new WriteError("changed", "That finalist has changed since it was added");
  }
}

/**
 * "Add a finalist" (guide §5.13, F21): straight onto the shortlist, without a
 * vendor first, so there is no `sourceVendorId`. The first package is the
 * finalist's own price and description, as a copy from a vendor stores its main
 * one. Undo removes it again, unless it has grown meanwhile.
 */
export async function addFinalist(input: NewFinalist, opts: WriteOptions = {}): Promise<Undoable> {
  const { id } = input;
  const name = input.name.trim();
  const packageName = input.packageName.trim();
  const hasPackage = packageName !== "" || (input.price ?? 0) > 0;
  await create(
    SHORTLIST,
    {
      name,
      type: input.category,
      contactName: "",
      contactPhone: "",
      price: input.price ?? 0,
      priceDescription: hasPackage ? packageName || "Package" : "",
      bridestoryReviewers: null,
      igFollowers: null,
      nextAction: "",
      notes: "",
      files: [],
      subEntries: [],
      sourceVendorId: null,
      preferredPackageId: MAIN_PACKAGE_ID,
    },
    { ...opts, id },
  );
  void logActivity("finalist.added", { name }, { kind: "finalist", id }, opts);
  return {
    undo: async () => {
      await removeWithUndo(SHORTLIST, id, { ...opts, guard: untouched });
      void logActivity("finalist.removed", { name }, { kind: "finalist", id }, opts);
    },
  };
}

/**
 * Copy to the shortlist. The price option we're leaning towards (or the
 * first) becomes the main package, the others become packages. Copying a
 * vendor that's already on the shortlist returns that finalist instead of a
 * second one (inventory-notes §5 #30). Undo removes the new finalist.
 */
export async function copyToShortlist(
  vendorId: string,
  opts: WriteOptions & { finalistId?: string } = {},
): Promise<Undoable & { finalistId: string; created: boolean }> {
  const database = requireDb(opts.db);
  const existing = await getDocs(
    query(collection(database, SHORTLIST), where("sourceVendorId", "==", vendorId), limit(1)),
  );
  if (!existing.empty) {
    return { finalistId: existing.docs[0].id, created: false, undo: async () => {} };
  }

  const finalistId = opts.finalistId ?? newId(SHORTLIST, { db: database });
  let name = "";
  const created = await transact(async (tx) => {
    const vendorSnap = await tx.get(doc(database, VENDORS, vendorId));
    if (!vendorSnap.exists()) throw new WriteError("missing", "That vendor is gone");
    const ref = doc(database, SHORTLIST, finalistId);
    if ((await tx.get(ref)).exists()) return false;
    const vendor = vendorFromDoc(vendorId, vendorSnap.data());
    name = vendor.name;
    const main = vendor.priceOptions.find((o) => o.selected) ?? vendor.priceOptions[0] ?? null;
    tx.set(ref, {
      name: vendor.name,
      type: vendor.category,
      contactName: vendor.contactName,
      contactPhone: vendor.contactPhone,
      price: main?.price ?? 0,
      priceDescription: main?.description ?? "",
      includes: main?.includes ?? "",
      bridestoryReviewers: vendor.reviewers,
      igFollowers: null,
      nextAction: vendor.nextAction,
      notes: vendor.notes,
      files: [],
      subEntries: vendor.priceOptions
        .filter((o) => o.id !== main?.id)
        .map((o) => ({
          id: makeId(),
          name: o.description || "Option",
          type: vendor.category,
          price: o.price,
          priceDescription: o.description,
          includes: o.includes,
          bridestoryReviewers: null,
          igFollowers: null,
          nextAction: "",
          notes: "",
          files: [],
        })),
      sourceVendorId: vendorId,
      preferredPackageId: MAIN_PACKAGE_ID,
      ...stamp(database, true),
    });
    return true;
  }, { db: database });

  if (created) void logActivity("finalist.added", { name }, { kind: "finalist", id: finalistId }, { db: database });
  return {
    finalistId,
    created,
    undo: async () => {
      await removeWithUndo(SHORTLIST, finalistId, { db: database });
    },
  };
}

/** The package we're leaning towards: the chosen one when it is a real package, otherwise the first real one. */
function leaningPackage(f: FinalistDoc): Package | null {
  const real = f.packages.filter(isPackage);
  return real.find((p) => p.id === f.preferredPackageId) ?? real[0] ?? null;
}

/** A new vendor record made from a finalist (from-scratch finalists only). */
function vendorFromFinalist(f: FinalistDoc, chosen: Package | null, extra: Record<string, unknown>) {
  return {
    name: f.name,
    category: f.category,
    contactName: f.contactName,
    contactPhone: f.contactPhone,
    contactEmail: "",
    contractStatus: "Consideration",
    priceOptions: f.packages.filter(isPackage).map((p) => ({
      id: p.id === MAIN_PACKAGE_ID ? makeId() : p.id,
      description: p.description || p.name,
      price: p.price,
      includes: p.includes,
      selected: p.id === chosen?.id,
    })),
    notes: f.notes,
    starred: false,
    images: [],
    // Files attached on the finalist come along on the vendor's old list; the new screens find them by address.
    files: f.files,
    bridestoryRating: null,
    bridestoryReviewCount: f.reviewers,
    confirmedType: f.category,
    funder: null,
    totalPrice: 0,
    budgetSpent: 0,
    nextTargetDate: null,
    nextAction: f.step,
    subEntries: [],
    ...extra,
  };
}

/** The fields as they were, with `deleteField()` for those that were missing, so an undo doesn't leave a `null` behind. */
function fieldsBefore(raw: Record<string, unknown>, keys: readonly string[]) {
  return Object.fromEntries(keys.map((k) => [k, k in raw ? raw[k] : deleteField()]));
}

/**
 * Book it (guide §5.14): the chosen package becomes the booking's estimate,
 * and its agreed price when none is set yet. A finalist copied from a vendor
 * books that vendor; one added straight to the shortlist becomes a new
 * vendor record that is a booking. Never twice: when that vendor is already
 * booked (here, from its own screen, or as Chosen or Done in the old screens)
 * it returns that booking and writes nothing. Undo takes the booking back and,
 * for a new record, removes it.
 */
export async function bookFinalist(
  finalistId: string,
  packageId: string | null,
  on: IsoDate | null,
  opts: WriteOptions & { vendorId?: string } = {},
): Promise<Undoable & { bookingId: string; vendorId: string }> {
  const database = requireDb(opts.db);
  const finalistRef = doc(database, SHORTLIST, finalistId);
  const plannedVendorId = opts.vendorId ?? newId(VENDORS, { db: database });

  const out = await transact(async (tx) => {
    const finalistSnap = await tx.get(finalistRef);
    if (!finalistSnap.exists()) throw new WriteError("missing", "That finalist is gone");
    const raw = finalistSnap.data();
    const finalist = finalistFromDoc(finalistId, raw);
    const targetId = finalistBookingVendorId(finalist);
    const targetRef = targetId ? doc(database, VENDORS, targetId) : null;
    const targetSnap = targetRef ? await tx.get(targetRef) : null;
    if (targetRef && targetSnap?.exists() && isVendorBooked(vendorFromDoc(targetRef.id, targetSnap.data()))) {
      return { vendorId: targetRef.id, already: true, created: false, vendorBefore: null, finalistBefore: null, name: finalist.name };
    }
    // No package at all books it without a price, as the sheet says.
    const chosen = packageId === null ? null : (finalist.packages.find((p) => p.id === packageId) ?? null);
    if (packageId !== null && !chosen) throw new WriteError("missing", "That package is gone");
    const price = chosen?.price ?? 0;

    const finalistBefore = fieldsBefore(raw, ["movedTo", "preferredPackageId", "sourceVendorId"]);
    const booking = { on, from: "finalist", removed: false };

    let vendorId: string;
    let created = false;
    let vendorBefore: Record<string, unknown> | null = null;
    if (targetRef && targetSnap?.exists()) {
      // Not booked (checked above): never booked, or its booking was removed.
      vendorId = targetRef.id;
      const v = targetSnap.data();
      const mark = bookingMark(v.booking);
      vendorBefore = fieldsBefore(v, ["booking", "contractStatus", "estimate", "totalPrice"]);
      tx.update(targetRef, {
        booking: mark ? { ...mark, on: on ?? mark.on, removed: false } : booking,
        contractStatus: v.contractStatus === "Done" ? "Done" : "Chosen",
        estimate: price,
        totalPrice: num(v.totalPrice) > 0 ? num(v.totalPrice) : price,
        ...stamp(database),
      });
    } else {
      vendorId = plannedVendorId;
      created = true;
      tx.set(
        doc(database, VENDORS, vendorId),
        {
          ...vendorFromFinalist(finalist, chosen, {
            contractStatus: "Chosen",
            totalPrice: price,
            estimate: price,
            booking,
          }),
          ...stamp(database, true),
        },
      );
    }
    tx.update(finalistRef, {
      movedTo: { kind: "booking", id: `vendor-${vendorId}` },
      // A vendor made from the finalist is its source from now on (as Move into
      // Vendors does), so the vendor finds it and Copy to the shortlist can't copy it twice.
      ...(created ? { sourceVendorId: vendorId } : {}),
      ...(packageId !== null ? { preferredPackageId: packageId } : {}),
      ...stamp(database),
    });
    return { vendorId, already: false, created, vendorBefore, finalistBefore, name: finalist.name };
  }, { db: database });

  const bookingId = `vendor-${out.vendorId}`;
  if (!out.already) {
    void logActivity("finalist.booked", { name: out.name }, { kind: "booking", id: bookingId }, { db: database });
  }
  return {
    bookingId,
    vendorId: out.vendorId,
    undo: async () => {
      if (out.already) return;
      await transact(async (tx) => {
        const vendorRef = doc(database, VENDORS, out.vendorId);
        const finalistSnap = await tx.get(finalistRef);
        const vendorSnap = await tx.get(vendorRef);
        if (out.created) {
          if (vendorSnap.exists()) tx.delete(vendorRef);
        } else if (vendorSnap.exists() && out.vendorBefore) {
          tx.update(vendorRef, { ...out.vendorBefore, ...stamp(database) });
        }
        if (finalistSnap.exists() && out.finalistBefore) {
          tx.update(finalistRef, { ...out.finalistBefore, ...stamp(database) });
        }
      }, { db: database });
    },
  };
}

/**
 * Move into Vendors (finalists added straight to the shortlist only): a new
 * vendor record at Considering with the packages as its price options. The
 * finalist stays, now copied from that vendor. Undo removes the vendor.
 */
export async function moveFinalistToVendors(
  finalistId: string,
  opts: WriteOptions & { vendorId?: string } = {},
): Promise<Undoable & { vendorId: string }> {
  const database = requireDb(opts.db);
  const finalistRef = doc(database, SHORTLIST, finalistId);
  const vendorId = opts.vendorId ?? newId(VENDORS, { db: database });
  const vendorRef = doc(database, VENDORS, vendorId);

  const before = await transact(async (tx) => {
    const snap = await tx.get(finalistRef);
    if (!snap.exists()) throw new WriteError("missing", "That finalist is gone");
    const raw = snap.data();
    const finalist = finalistFromDoc(finalistId, raw);
    if (finalist.sourceVendorId) {
      if (finalist.sourceVendorId === vendorId) return null; // a retry that already landed
      throw new WriteError("failed", "This finalist is already in Vendors");
    }
    tx.set(vendorRef, { ...vendorFromFinalist(finalist, leaningPackage(finalist), {}), ...stamp(database, true) });
    tx.update(finalistRef, {
      sourceVendorId: vendorId,
      movedTo: { kind: "vendor", id: vendorId },
      ...stamp(database),
    });
    return { sourceVendorId: raw.sourceVendorId ?? null, movedTo: raw.movedTo ?? null, name: finalist.name };
  }, { db: database });

  if (before) void logActivity("vendor.added", { name: before.name }, { kind: "vendor", id: vendorId }, { db: database });
  return {
    vendorId,
    undo: async () => {
      if (!before) return;
      await transact(async (tx) => {
        const [finalistSnap, vendorSnap] = await Promise.all([tx.get(finalistRef), tx.get(vendorRef)]);
        if (vendorSnap.exists()) tx.delete(vendorRef);
        if (finalistSnap.exists()) {
          tx.update(finalistRef, { sourceVendorId: before.sourceVendorId, movedTo: before.movedTo, ...stamp(database) });
        }
      }, { db: database });
    },
  };
}

/**
 * Removes a finalist (need N10), with undo. The vendor it was copied from, its
 * files and any booking stay; the activity entry tells the partner's open screen.
 */
export async function removeFinalist(finalistId: string, opts: WriteOptions = {}): Promise<Undoable> {
  const done = await removeWithUndo(SHORTLIST, finalistId, opts);
  void logActivity("finalist.removed", { name: String(done.data.name ?? "") }, { kind: "finalist", id: finalistId }, opts);
  return { undo: done.undo };
}

// ---------- a finalist's own screen (guide §5.14) ----------

export interface FinalistPage {
  /** Null when there is no such finalist here (an old link), or it was removed. */
  finalist: FinalistDetail | null;
}

/**
 * One finalist with what its screen shows beside it: the vendor it was copied
 * from (when that vendor is still in Vendors), its files (its own, then the
 * source vendor's, which are not copied: F20) and each package's files.
 */
export function useFinalist(id: string): Loaded<FinalistPage> {
  const { connection } = useSession();
  const finalists = useCollection<FinalistDoc>(SHORTLIST, finalistFromDoc, []);
  const vendors = useCollection<VendorDoc>(VENDORS, vendorFromDoc, []);
  const files = useCollection<FileDoc>("weddingFiles", fileFromDoc, []);

  const page = useMemo<FinalistPage>(() => {
    const doc = finalists.data.find((f) => f.id === id);
    if (!doc) return { finalist: null };
    const vendorDoc = doc.sourceVendorId
      ? vendors.data.find((v) => v.id === doc.sourceVendorId && isListedVendor(v))
      : undefined;
    const byId = new Map(files.data.map((f) => [f.id, f]));
    const tiles = (refs: RecordRef[], legacy: unknown, withVendor: boolean): FinalistFile[] => {
      const own = new Set(filesForRecord([refs[0]], files.data, []).map((f) => f.id));
      return filesForRecord(refs, files.data, legacy).map((f) => {
        const stored = f.id ? byId.get(f.id) : undefined;
        return {
          id: f.id,
          name: f.name,
          url: f.url,
          size: stored?.fileSize || null,
          mime: stored?.fileType ?? "",
          fromVendor: withVendor && f.id !== null && !own.has(f.id),
        };
      });
    };
    const refs: RecordRef[] = [{ kind: "finalist", id }];
    // The vendor's files are on the finalist whether or not the vendor is still listed, so a removed vendor's files stay.
    if (doc.sourceVendorId) refs.push({ kind: "vendor", id: doc.sourceVendorId });
    const packageFiles: Record<string, FinalistFile[]> = {};
    for (const p of doc.packages) {
      if (p.id === MAIN_PACKAGE_ID) continue;
      packageFiles[p.id] = tiles([{ kind: "finalist", id, partId: p.id }], p.files, false);
    }
    return {
      finalist: finalistDetail({ ...doc, bookingId: finalistBookingId(doc, new Map(vendors.data.map((v) => [v.id, v]))) }, {
        sourceVendor: vendorDoc ? { id: vendorDoc.id, name: vendorDoc.name, booked: isVendorBooked(vendorDoc) } : null,
        files: tiles(refs, doc.files, true),
        packageFiles,
      }),
    };
  }, [finalists.data, vendors.data, files.data, id]);

  return readOf(connection, [finalists, vendors, files], page);
}

/** The fields the contact and popularity rows save (guide §5.14). */
export interface FinalistFields {
  contactName: string;
  contactPhone: string;
  reviewers: number | null;
  followers: number | null;
  step: string;
  notes: string;
}

const STORED: { [K in keyof FinalistFields]: (value: FinalistFields[K]) => Record<string, unknown> } = {
  contactName: (value) => ({ contactName: value }),
  contactPhone: (value) => ({ contactPhone: value }),
  reviewers: (value) => ({ bridestoryReviewers: value }),
  followers: (value) => ({ igFollowers: value }),
  step: (value) => ({ nextAction: value }),
  notes: (value) => ({ notes: value }),
};

/** Saves one field of the finalist, by the stored names the old screens read. */
export function setFinalistField<K extends keyof FinalistFields>(
  id: string,
  field: K,
  value: FinalistFields[K],
  opts: WriteOptions = {},
): Promise<void> {
  return update(SHORTLIST, id, STORED[field](value), opts);
}

// ---------- packages (F17) ----------

export interface PackageInput {
  /** Made when the sheet opened, so Try again adds the same package. */
  id: string;
  name: string;
  price: number;
  includes: string;
  reviewers: number | null;
  step: string;
  notes: string;
}

/**
 * Adds a package at the end, as the old screens store one (`subEntries`). The
 * first package on a finalist is the one we're leaning towards. Adding an id
 * that is already there does nothing. Undo puts the earlier list back, and
 * refuses with `changed` when the packages were changed since.
 */
export function addPackage(finalistId: string, input: PackageInput, opts: WriteOptions = {}) {
  return patchWithUndo(
    SHORTLIST,
    finalistId,
    (data) => {
      const items = withElementIds<Element>(data.subEntries);
      if (items.some((i) => i.id === input.id)) return null;
      const name = input.name.trim();
      const added: Element = {
        id: input.id,
        name,
        type: typeof data.type === "string" ? data.type : "Other",
        price: input.price,
        priceDescription: name,
        includes: input.includes,
        bridestoryReviewers: input.reviewers,
        igFollowers: null,
        nextAction: input.step,
        notes: input.notes,
        files: [],
      };
      const first = !finalistFromDoc(finalistId, data).packages.some(isPackage);
      return { patch: { subEntries: [...items, added], ...(first ? { preferredPackageId: input.id } : {}) } };
    },
    opts,
  );
}

/**
 * Changes one package as it is edited in its sheet (saves as you go). The
 * finalist's own price is package `main`: its name is the price's description,
 * and it has no reviews, step or notes apart from the finalist's.
 */
export function updatePackage(
  finalistId: string,
  packageId: string,
  patch: Partial<Omit<PackageInput, "id">>,
  opts: WriteOptions = {},
): Promise<void> {
  if (packageId === MAIN_PACKAGE_ID) {
    const stored: Record<string, unknown> = {};
    if (patch.name !== undefined) stored.priceDescription = patch.name.trim();
    if (patch.price !== undefined) stored.price = patch.price;
    if (patch.includes !== undefined) stored.includes = patch.includes;
    return update(SHORTLIST, finalistId, stored, opts);
  }
  return mutateArray(
    SHORTLIST,
    finalistId,
    "subEntries",
    (items) => {
      if (!items.some((i) => i.id === packageId)) throw new WriteError("missing", `Package ${packageId} is gone`);
      return {
        items: items.map((i) => {
          if (i.id !== packageId) return i;
          const next: Element = { ...i };
          if (patch.name !== undefined) {
            const name = patch.name.trim();
            // The old screens' description follows the name unless someone wrote it apart from it.
            if (!i.priceDescription || i.priceDescription === i.name) next.priceDescription = name;
            next.name = name;
          }
          if (patch.price !== undefined) next.price = patch.price;
          if (patch.includes !== undefined) next.includes = patch.includes;
          if (patch.reviewers !== undefined) next.bridestoryReviewers = patch.reviewers;
          if (patch.step !== undefined) next.nextAction = patch.step;
          if (patch.notes !== undefined) next.notes = patch.notes;
          return next;
        }),
        result: undefined,
      };
    },
    opts,
  );
}

/** "Lean towards this one": this package is the one we're leaning towards. */
export function leanTowardsPackage(finalistId: string, packageId: string, opts: WriteOptions = {}) {
  return patchWithUndo(
    SHORTLIST,
    finalistId,
    (data) => (data.preferredPackageId === packageId ? null : { patch: { preferredPackageId: packageId } }),
    opts,
  );
}

/**
 * Removes a package, with an undo that puts it back. The finalist's own price
 * can't leave the document, so removing it clears its price and words.
 */
export function removePackage(finalistId: string, packageId: string, opts: WriteOptions = {}) {
  if (packageId === MAIN_PACKAGE_ID) {
    return patchWithUndo(SHORTLIST, finalistId, () => ({ patch: { price: 0, priceDescription: "", includes: "" } }), opts);
  }
  return removeElementWithUndo<Element>(SHORTLIST, finalistId, "subEntries", packageId, opts);
}
