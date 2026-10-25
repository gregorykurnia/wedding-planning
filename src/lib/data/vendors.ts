"use client";

import { useMemo } from "react";
import { useCollection } from "@/lib/use-collection";
import { useCustomVendorCategories } from "@/lib/collections/vendor-categories";
import { fileFromDoc, filesForRecord, type FileDoc } from "@/lib/data/adapters/files";
import { vendorFromDoc, type VendorDoc } from "@/lib/data/adapters/bookings";
import { finalistFromDoc, type FinalistDoc } from "@/lib/data/adapters/shortlist";
import type { IsoDate } from "@/lib/model/bookings";
import { isVendorBooked } from "@/lib/model/bookings";
import { categoryList, storedOrDefault, type StoredCategory } from "@/lib/model/categories";
import { vendorDetail, type VendorDetail, type VendorFile } from "@/lib/model/vendor-detail";
import { vendorListItem, type VendorListItem } from "@/lib/model/vendors";
import { isListedVendor } from "@/lib/model/search";
import { logActivity } from "./activity";
import { withElementIds, mutateArray, type Element } from "./array-ops";
import { markBooked, removeVendor } from "./bookings";
import { patchWithUndo, removeElementWithUndo, removeWithUndo, updateWithUndo, type Undoable } from "./undo";
import { mergeStatus, readOf } from "./read";
import { useSession } from "./session";
import type { Loaded } from "./settings";
import { create, update, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

/**
 * The vendors (guide §5.11): every vendor that isn't a direct booking, as the
 * list reads it, with whether it is booked, how many files it has (Files first,
 * then legacy ones not imported yet) and the finalist that is it on the shortlist.
 */
export function useVendors(): Loaded<VendorListItem[]> {
  const { connection } = useSession();
  // No ordering: a document without `createdAt` must not drop out of the list.
  const vendors = useCollection<VendorDoc>("vendors", vendorFromDoc, []);
  const finalists = useCollection<FinalistDoc>("shortlist", finalistFromDoc, []);
  const files = useCollection<FileDoc>("weddingFiles", fileFromDoc, []);

  const items = useMemo(() => {
    const finalistOf = new Map<string, string>();
    for (const f of finalists.data) {
      if (f.sourceVendorId && !finalistOf.has(f.sourceVendorId)) finalistOf.set(f.sourceVendorId, f.id);
    }
    const filesOf = new Map<string, FileDoc[]>();
    for (const file of files.data) {
      if (file.recordRef?.kind !== "vendor") continue;
      const list = filesOf.get(file.recordRef.id);
      if (list) list.push(file);
      else filesOf.set(file.recordRef.id, [file]);
    }
    return vendors.data.filter(isListedVendor).map((v) =>
      vendorListItem(v, {
        booked: isVendorBooked(v),
        fileCount: filesForRecord([{ kind: "vendor", id: v.id }], filesOf.get(v.id) ?? [], v.files).length,
        finalistId: finalistOf.get(v.id) ?? null,
      }),
    );
  }, [vendors.data, finalists.data, files.data]);

  return readOf(connection, [vendors, finalists, files], items, 1);
}

export interface CategoriesData {
  /** Every category but Other, with the id it is (or will be) stored under. */
  stored: readonly StoredCategory[];
  /** A to Z, then Other. */
  list: string[];
}

/** The shared category list (guide §5.11, F14). */
export function useCategories(): Loaded<CategoriesData> {
  const { connection } = useSession();
  const custom = useCustomVendorCategories();
  const data = useMemo(
    () => ({ stored: storedOrDefault(custom.data), list: categoryList(custom.data) }),
    [custom.data],
  );
  return readOf(connection, [custom], data);
}

/** The vendors and the category list as one read, for the screen and the categories sheet. */
export function useVendorsAndCategories(): Loaded<[VendorListItem[], CategoriesData]> {
  const vendors = useVendors();
  const categories = useCategories();
  const status = mergeStatus(vendors, categories);
  const data = useMemo<[VendorListItem[], CategoriesData] | null>(
    () => (vendors.data && categories.data ? [vendors.data, categories.data] : null),
    [vendors.data, categories.data],
  );
  return { status, data: status === "demo" ? null : data };
}

export interface NewVendor {
  /** Made when the sheet's form began, so Try again writes the same record. */
  id: string;
  name: string;
  category: string;
  contactName: string;
  contactPhone: string;
  notes: string;
}

/** Stops an undo of an add from deleting a vendor that has grown since (a price, a file, a booking). */
function untouched(data: Record<string, unknown>) {
  const filled = (v: unknown) => Array.isArray(v) && v.length > 0;
  if (data.booking || filled(data.priceOptions) || filled(data.files) || filled(data.subEntries)) {
    throw new WriteError("changed", "That vendor has changed since it was added");
  }
}

/**
 * Adds a vendor at the first stage with no price, so a name is enough (F6). The
 * fields are the ones the old screens read, so both UIs show the new vendor.
 * Undo removes it again, unless it has grown meanwhile.
 */
export async function addVendor(input: NewVendor, opts: WriteOptions = {}): Promise<Undoable> {
  const { id, ...fields } = input;
  const name = fields.name.trim();
  await create(
    "vendors",
    {
      name,
      category: fields.category,
      contactName: fields.contactName.trim(),
      contactPhone: fields.contactPhone.trim(),
      contactEmail: "",
      contractStatus: "List",
      priceOptions: [],
      notes: fields.notes,
      starred: false,
      images: [],
      files: [],
      bridestoryRating: null,
      bridestoryReviewCount: null,
      confirmedType: fields.category,
      funder: null,
      totalPrice: 0,
      budgetSpent: 0,
      nextTargetDate: null,
      nextAction: "",
      subEntries: [],
    },
    { ...opts, id },
  );
  void logActivity("vendor.added", { name }, { kind: "vendor", id }, opts);
  return {
    undo: async () => {
      await removeWithUndo("vendors", id, { ...opts, guard: untouched });
      void logActivity("vendor.removed", { name }, { kind: "vendor", id }, opts);
    },
  };
}

/** Marks a vendor as one we're keen on, or not (F11). */
export function setVendorKeen(id: string, keen: boolean, opts: WriteOptions = {}): Promise<void> {
  return update("vendors", id, { starred: keen }, opts);
}


// ---------- a vendor's own screen (guide §5.12) ----------

export interface VendorPage {
  /** Null when there is no such vendor here (an old link), or it was removed. */
  vendor: VendorDetail | null;
  /** A to Z, then Other; the vendor's own category is in it even if it isn't a known one. */
  categories: string[];
}

/**
 * One vendor with what its screen shows beside it: the finalist that is it on
 * the shortlist, its files (Files first, then legacy ones not imported yet),
 * whether it is a live booking, and the category list. A direct booking has no
 * place among the vendors, so it reads as not being here.
 */
export function useVendor(id: string): Loaded<VendorPage> {
  const { connection } = useSession();
  const vendors = useCollection<VendorDoc>("vendors", vendorFromDoc, []);
  const finalists = useCollection<FinalistDoc>("shortlist", finalistFromDoc, []);
  const files = useCollection<FileDoc>("weddingFiles", fileFromDoc, []);
  const custom = useCustomVendorCategories();

  const page = useMemo<VendorPage>(() => {
    const known = categoryList(custom.data);
    const doc = vendors.data.find((v) => v.id === id && isListedVendor(v));
    if (!doc) return { vendor: null, categories: known };
    const byId = new Map(files.data.map((f) => [f.id, f]));
    const own = filesForRecord([{ kind: "vendor", id }], files.data, doc.files).map<VendorFile>((f) => {
      const stored = f.id ? byId.get(f.id) : undefined;
      return { id: f.id, name: f.name, url: f.url, size: stored?.fileSize || null, mime: stored?.fileType ?? "" };
    });
    return {
      vendor: vendorDetail(doc, {
        booked: isVendorBooked(doc),
        finalistId: finalists.data.find((f) => f.sourceVendorId === id)?.id ?? null,
        files: own,
      }),
      categories: known.includes(doc.category) ? known : [...known, doc.category],
    };
  }, [vendors.data, finalists.data, files.data, custom.data, id]);

  // The finalist and the files are on the page itself: offline, until they have
  // arrived the vendor would show no files and offer to copy it to the shortlist
  // again, so the screen waits for them as for the vendor (guide §6.5, P6-S15).
  return readOf(connection, [vendors, finalists, files, custom], page, 3);
}

/** The fields the contact and reputation rows save (guide §5.12). */
export interface VendorFields {
  contactName: string;
  contactPhone: string;
  category: string;
  rating: number | null;
  reviewers: number | null;
  notes: string;
}

const STORED: { [K in keyof VendorFields]: (value: VendorFields[K]) => Record<string, unknown> } = {
  contactName: (value) => ({ contactName: value }),
  contactPhone: (value) => ({ contactPhone: value }),
  // Category and the old UI's confirmed type are one thing (see `renameCategory`).
  category: (value) => ({ category: value, confirmedType: value }),
  rating: (value) => ({ bridestoryRating: value }),
  reviewers: (value) => ({ bridestoryReviewCount: value }),
  notes: (value) => ({ notes: value }),
};

/** Saves one field of the vendor, by the stored names the old screens read. */
export function setVendorField<K extends keyof VendorFields>(
  id: string,
  field: K,
  value: VendorFields[K],
  opts: WriteOptions = {},
): Promise<void> {
  return update("vendors", id, STORED[field](value), opts);
}

/**
 * Sets the stage (guide §5.12, F10). Chosen makes the vendor a booking, once
 * (B1, `markBooked`); `becameBooking` says whether it just did, for the toast
 * with Open. Choosing Chosen for a vendor that already is one only moves the stage.
 */
export async function setVendorStage(
  id: string,
  stage: string,
  today: IsoDate,
  opts: WriteOptions = {},
): Promise<Undoable & { becameBooking: boolean }> {
  if (stage === "Chosen") {
    const done = await markBooked({ kind: "vendor", id }, today, opts);
    if (done.changed) return { undo: done.undo, becameBooking: true };
  }
  const done = await updateWithUndo("vendors", id, { contractStatus: stage }, opts);
  return { undo: done.undo, becameBooking: false };
}

// ---------- price options (F8) ----------

export interface PriceOptionInput {
  /** Made when the sheet opened, so Try again adds the same option. */
  id: string;
  name: string;
  price: number;
  includes: string;
  leaning: boolean;
}

/** An option as it is stored: the name is `description`, "leaning towards" is `selected`. */
function storedOption(o: PriceOptionInput): Element {
  return { id: o.id, description: o.name.trim(), price: o.price, includes: o.includes, selected: o.leaning };
}

/**
 * Adds an option at the end. One option is the one we're leaning towards, so
 * adding one that is clears the others in the same write. Adding an id that
 * is already there does nothing. Undo puts the earlier list back, and refuses
 * with `changed` when the list was changed since (the partner priced another option).
 */
export function addPriceOption(vendorId: string, option: PriceOptionInput, opts: WriteOptions = {}) {
  return patchWithUndo(
    "vendors",
    vendorId,
    (data) => {
      const items = withElementIds<Element>(data.priceOptions);
      if (items.some((i) => i.id === option.id)) return null;
      const kept = option.leaning ? items.map((i) => ({ ...i, selected: false })) : items;
      return { patch: { priceOptions: [...kept, storedOption(option)] } };
    },
    opts,
  );
}

/** Changes one option as it is edited in its sheet (saves as you go). Ticking "leaning" clears the others. */
export function updatePriceOption(
  vendorId: string,
  optionId: string,
  patch: Partial<Omit<PriceOptionInput, "id">>,
  opts: WriteOptions = {},
): Promise<void> {
  const stored: Record<string, unknown> = {};
  if (patch.name !== undefined) stored.description = patch.name.trim();
  if (patch.price !== undefined) stored.price = patch.price;
  if (patch.includes !== undefined) stored.includes = patch.includes;
  if (patch.leaning !== undefined) stored.selected = patch.leaning;
  return mutateArray(
    "vendors",
    vendorId,
    "priceOptions",
    (items) => {
      if (!items.some((i) => i.id === optionId)) throw new WriteError("missing", `Price option ${optionId} is gone`);
      return {
        items: items.map((i) =>
          i.id === optionId ? { ...i, ...stored } : patch.leaning === true ? { ...i, selected: false } : i,
        ),
        result: undefined,
      };
    },
    opts,
  );
}

/** "Lean towards this one": this option is chosen and the others aren't. */
export function leanTowards(vendorId: string, optionId: string, opts: WriteOptions = {}) {
  return patchWithUndo(
    "vendors",
    vendorId,
    (data) => {
      const items = withElementIds<Element>(data.priceOptions);
      if (!items.some((i) => i.id === optionId)) throw new WriteError("missing", `Price option ${optionId} is gone`);
      if (items.every((i) => (i.id === optionId) === (i.selected === true))) return null;
      return { patch: { priceOptions: items.map((i) => ({ ...i, selected: i.id === optionId })) } };
    },
    opts,
  );
}

/** Removes one option, with an undo that puts it back at the same place. */
export function removePriceOption(vendorId: string, optionId: string, opts: WriteOptions = {}) {
  return removeElementWithUndo<Element>("vendors", vendorId, "priceOptions", optionId, opts);
}

// ---------- removing the vendor (N10) ----------

/**
 * Removes a vendor from Vendors (guide §5.12, N10). What came from it stays: its
 * files stay in Files, and so does its copy on the shortlist. A vendor that is a
 * live booking can't be deleted, because the record is the booking and its
 * payments (plan §2.7): it is made a direct booking instead, which leaves the list
 * and stays in the budget. Undo puts the vendor back as it was.
 */
export async function removeVendorFromList(id: string, opts: WriteOptions = {}): Promise<Undoable> {
  let name = "";
  const left = await patchWithUndo(
    "vendors",
    id,
    (data) => {
      name = String(data.name ?? "");
      const vendor = vendorFromDoc(id, data);
      if (!isVendorBooked(vendor)) return null;
      const mark = vendor.booking;
      return { patch: { booking: { on: mark?.on ?? null, from: "direct", removed: false } } };
    },
    opts,
  );
  const done = left.changed ? left : await removeVendor(id, opts);
  void logActivity("vendor.removed", { name }, { kind: "vendor", id }, opts);
  return { undo: done.undo };
}
