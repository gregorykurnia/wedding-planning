"use client";

import { useMemo } from "react";
import { useCollection } from "@/lib/use-collection";
import { useCustomVendorCategories, type CustomVendorCategory } from "@/lib/collections/vendor-categories";
import { fileFromDoc, filesForRecord, type FileDoc } from "@/lib/data/adapters/files";
import { vendorFromDoc, type VendorDoc } from "@/lib/data/adapters/bookings";
import { finalistFromDoc, type FinalistDoc } from "@/lib/data/adapters/shortlist";
import { isVendorBooked } from "@/lib/model/bookings";
import { buildCategories } from "@/lib/model/categories";
import { vendorListItem, type VendorListItem } from "@/lib/model/vendors";
import { isListedVendor } from "@/lib/model/search";
import { logActivity } from "./activity";
import { removeWithUndo, type Undoable } from "./undo";
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

  return readOf(connection, [vendors, finalists, files], items);
}

export interface CategoriesData {
  /** The ones we added, with the id each is stored under. */
  custom: CustomVendorCategory[];
  /** Built-ins, ours in the order they were added, then Other. */
  list: string[];
}

/** The shared category list (guide §5.11, F14). */
export function useCategories(): Loaded<CategoriesData> {
  const { connection } = useSession();
  const custom = useCustomVendorCategories();
  const data = useMemo(
    () => ({ custom: custom.data, list: buildCategories(custom.data.map((c) => c.name)) }),
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
