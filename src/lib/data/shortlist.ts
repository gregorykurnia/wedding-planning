import { collection, doc, getDocs, limit, query, where } from "firebase/firestore";
import type { IsoDate } from "@/lib/model/bookings";
import { logActivity } from "./activity";
import { bookingMark, vendorFromDoc } from "./adapters/bookings";
import { num } from "./adapters/common";
import { finalistFromDoc, MAIN_PACKAGE_ID, type FinalistDoc, type Package } from "./adapters/shortlist";
import { requireDb } from "./db";
import { removeWithUndo, type Undoable } from "./undo";
import { newId, stamp, transact, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

/**
 * Shortlist writes (guide §5.12–§5.14, F17–F21, F24). A finalist copied from a
 * vendor keeps `sourceVendorId`, so the vendor's files show on it without
 * being copied (F20). Booking a finalist or moving it into Vendors records
 * where it went in `movedTo`.
 */
const SHORTLIST = "shortlist";
const VENDORS = "vendors";

const makeId = () => crypto.randomUUID();

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

/** A new vendor record made from a finalist (from-scratch finalists only). */
function vendorFromFinalist(f: FinalistDoc, chosen: Package, extra: Record<string, unknown>) {
  return {
    name: f.name,
    category: f.category,
    contactName: f.contactName,
    contactPhone: f.contactPhone,
    contactEmail: "",
    contractStatus: "Consideration",
    priceOptions: f.packages.map((p) => ({
      id: p.id === MAIN_PACKAGE_ID ? makeId() : p.id,
      description: p.description || p.name,
      price: p.price,
      selected: p.id === chosen.id,
    })),
    notes: f.notes,
    starred: false,
    images: [],
    files: [],
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

/**
 * Book it (guide §5.14): the chosen package becomes the booking's estimate,
 * and its agreed price when none is set yet. A finalist copied from a vendor
 * books that vendor; one added straight to the shortlist becomes a new
 * vendor record that is a booking. Never twice: a finalist that's already a
 * booking returns that booking. Undo takes the booking back and, for a new
 * record, removes it.
 */
export async function bookFinalist(
  finalistId: string,
  packageId: string,
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
    if (finalist.movedTo?.kind === "booking") {
      const vendorId = finalist.movedTo.id.replace(/^vendor-/, "");
      return { vendorId, already: true, created: false, vendorBefore: null, finalistBefore: null, name: finalist.name };
    }
    const chosen = finalist.packages.find((p) => p.id === packageId);
    if (!chosen) throw new WriteError("missing", "That package is gone");

    const sourceRef = finalist.sourceVendorId ? doc(database, VENDORS, finalist.sourceVendorId) : null;
    const sourceSnap = sourceRef ? await tx.get(sourceRef) : null;
    const finalistBefore = {
      movedTo: raw.movedTo ?? null,
      preferredPackageId: raw.preferredPackageId ?? null,
    };
    const booking = { on, from: "finalist", removed: false };

    let vendorId: string;
    let created = false;
    let vendorBefore: Record<string, unknown> | null = null;
    if (sourceRef && sourceSnap?.exists()) {
      vendorId = sourceRef.id;
      const v = sourceSnap.data();
      const mark = bookingMark(v.booking);
      vendorBefore = {
        booking: v.booking ?? null,
        contractStatus: v.contractStatus ?? null,
        estimate: v.estimate ?? null,
        totalPrice: v.totalPrice ?? 0,
      };
      if (!mark || mark.removed) {
        tx.update(sourceRef, {
          booking: mark ? { ...mark, removed: false } : booking,
          contractStatus: v.contractStatus === "Done" ? "Done" : "Chosen",
          estimate: chosen.price,
          totalPrice: num(v.totalPrice) > 0 ? num(v.totalPrice) : chosen.price,
          ...stamp(database),
        });
      }
    } else {
      vendorId = plannedVendorId;
      created = true;
      tx.set(
        doc(database, VENDORS, vendorId),
        {
          ...vendorFromFinalist(finalist, chosen, {
            contractStatus: "Chosen",
            totalPrice: chosen.price,
            estimate: chosen.price,
            booking,
          }),
          ...stamp(database, true),
        },
      );
    }
    tx.update(finalistRef, {
      movedTo: { kind: "booking", id: `vendor-${vendorId}` },
      preferredPackageId: packageId,
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
    const chosen = finalist.packages.find((p) => p.id === finalist.preferredPackageId) ?? finalist.packages[0];
    tx.set(vendorRef, { ...vendorFromFinalist(finalist, chosen, {}), ...stamp(database, true) });
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

/** Removes a finalist (need N10), with undo. */
export function removeFinalist(finalistId: string, opts: WriteOptions = {}) {
  return removeWithUndo(SHORTLIST, finalistId, opts);
}
