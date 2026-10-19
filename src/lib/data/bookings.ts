import { doc, type DocumentData } from "firebase/firestore";
import {
  bookingFromVendor,
  bookingFromVenue,
  isVendorBooked,
  isVenueBooked,
  leaningOptionPrice,
  type FunderId,
  type IsoDate,
  type Part,
} from "@/lib/model/bookings";
import { splitPlan } from "@/lib/model/money";
import { logActivity } from "./activity";
import { bookingMark, vendorFromDoc, venueFromDoc } from "./adapters/bookings";
import { num } from "./adapters/common";
import { withElementIds, type Element } from "./array-ops";
import { changedSince, patchWithUndo, removeAddedElement, sameValue, removeElementWithUndo, removeWithUndo, type Undoable } from "./undo";
import { afterOwnWrites, newId, stamp, transact, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

/**
 * Booking and money writes (guide §6.9, §5.6, §5.7, §5.10, §5.12, §5.15).
 * Each runs in a transaction on the record as it is now, never on a copy a
 * screen holds, and each returns an undo for the guide §6.2 toast.
 *
 * A booking is a vendor or venue record with `booking` set and not removed
 * (plan §2.7). Stored field names stay, so the old UI reads the same data:
 * `totalPrice`/`agreedPrice` are the price, `budgetSpent` is what's paid,
 * `subEntries` are the parts.
 */

export type BookedKind = "vendor" | "venue";

export interface RecordTarget {
  kind: BookedKind;
  id: string;
}

export const collectionOf = (kind: BookedKind) => (kind === "vendor" ? "vendors" : "venues");

/** `vendor-<id>` or `venue-<id>`, as in booking URLs. */
export const bookingIdOf = (t: RecordTarget) => `${t.kind}-${t.id}`;

export function parseBookingId(bookingId: string): RecordTarget | null {
  const match = /^(vendor|venue)-(.+)$/.exec(bookingId);
  return match ? { kind: match[1] as BookedKind, id: match[2] } : null;
}

const makeId = () => crypto.randomUUID();

/** A model part as stored in `subEntries` (the old field names). */
function storedPart(p: Part): Record<string, unknown> & { id: string } {
  return {
    id: p.id ?? makeId(),
    name: p.name,
    funder: p.funder,
    totalPrice: p.price,
    budgetSpent: p.paid,
    nextTargetDate: p.due,
    nextAction: p.step,
    files: [],
  };
}

function isBooked(kind: BookedKind, id: string, data: DocumentData) {
  return kind === "vendor" ? isVendorBooked(vendorFromDoc(id, data)) : isVenueBooked(venueFromDoc(id, data));
}

function bookingOf(kind: BookedKind, id: string, data: DocumentData) {
  return kind === "vendor" ? bookingFromVendor(vendorFromDoc(id, data)) : bookingFromVenue(venueFromDoc(id, data));
}

/* ---------- becoming a booking ---------- */

/**
 * The stage that makes a vendor or venue a booking (Chosen, Booked). Sets the
 * stage and `booking` together, keeps the comparison estimate apart from the
 * agreed price (B12): a vendor's estimate is the price option we were leaning
 * towards, a venue's agreed price starts at its estimate. Never twice: a
 * record that is already a booking keeps its booking as it is. A removed one
 * comes back with its old date.
 */
export async function markBooked(
  target: RecordTarget,
  on: IsoDate | null,
  opts: WriteOptions & { from?: "vendor" | "venue" | "finalist" } = {},
): Promise<Undoable & { changed: boolean }> {
  const { kind, id } = target;
  let name = "";
  const done = await patchWithUndo(
    collectionOf(kind),
    id,
    (data) => {
      name = String(data.name ?? "");
      const mark = bookingMark(data.booking);
      if (mark && !mark.removed) return null;
      const patch: Record<string, unknown> = {
        booking: mark ? { ...mark, removed: false } : { on, from: opts.from ?? kind, removed: false },
      };
      if (kind === "vendor") {
        if (data.contractStatus !== "Chosen" && data.contractStatus !== "Done") patch.contractStatus = "Chosen";
        // A stored null is "No estimate", cleared on purpose, and stays.
        if (data.estimate === undefined) patch.estimate = leaningOptionPrice(vendorFromDoc(id, data));
      } else {
        if (data.status !== "Booked") patch.status = "Booked";
        if (typeof data.agreedPrice !== "number") patch.agreedPrice = num(data.budgetEstimate);
      }
      return { patch };
    },
    opts,
  );
  if (done.changed) {
    void logActivity(`${kind}.booked`, { name }, { kind: "booking", id: bookingIdOf(target) }, opts);
  }
  return done;
}

/**
 * A venue's estimate, `budgetEstimate` (blank is stored as 0). Until migration
 * 1.11 gives a booked venue its own agreed price, its price reads from the
 * estimate, so that price is first kept as its own: changing the estimate never
 * changes what was agreed. A venue not booked yet takes its estimate as its
 * price when it's booked (`markBooked`), so it's left alone.
 */
export async function setVenueEstimate(id: string, value: number | null, opts: WriteOptions = {}): Promise<void> {
  await transact(async (tx, database) => {
    const ref = doc(database, "venues", id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new WriteError("missing", `venues/${id} is gone`);
    const data = snap.data();
    const keep = typeof data.agreedPrice !== "number" && isBooked("venue", id, data) ? { agreedPrice: num(data.budgetEstimate) } : {};
    tx.update(ref, { budgetEstimate: value ?? 0, ...keep, ...stamp(database) });
  }, opts);
}

export interface DirectBookingInput {
  name: string;
  category: string;
  price: number;
  paid: number;
  funder: FunderId;
  due: IsoDate | null;
  step: string;
  /** The `weddingFiles` ids attached while adding: each is linked to the booking in the same write (§5.7). */
  files?: readonly string[];
  /** The booking's own folder in Files (`Files › Bookings › <name>`), which the attached files move into (P4-S6). */
  folderId?: string;
}

/**
 * Add a booking (guide §5.7): something booked outside Vendors and Venues. It's
 * a vendor record with `booking.from = "direct"`, left out of the Vendors list.
 * The record and the links to its attached files are one write, so a failure
 * leaves neither. Pass the same `id` to retry after a failure. An attached file
 * deleted before the add lands is left out, so Try again can't fail on it for
 * ever (P4-S6).
 */
export async function addDirectBooking(
  input: DirectBookingInput,
  on: IsoDate | null,
  opts: WriteOptions & { id?: string } = {},
): Promise<{ bookingId: string; id: string }> {
  const name = input.name.trim();
  if (!name) throw new WriteError("failed", "A booking needs a name");
  const id = opts.id ?? newId("vendors", opts);
  const bookingId = bookingIdOf({ kind: "vendor", id });
  await transact(async (tx, database) => {
    const files = [];
    for (const fileId of input.files ?? []) {
      const ref = doc(database, "weddingFiles", fileId);
      if ((await tx.get(ref)).exists()) files.push(ref);
    }
    tx.set(doc(database, "vendors", id), {
      name,
      category: input.category,
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      contractStatus: "Chosen",
      priceOptions: [],
      notes: "",
      starred: false,
      images: [],
      files: [],
      bridestoryRating: null,
      bridestoryReviewCount: null,
      confirmedType: input.category,
      funder: input.funder,
      totalPrice: input.price,
      budgetSpent: input.paid,
      nextTargetDate: input.due,
      nextAction: input.step,
      subEntries: [],
      booking: { on, from: "direct", removed: false },
      estimate: null,
      ...stamp(database, true),
    });
    const place = input.folderId ? { folderId: input.folderId } : {};
    for (const ref of files) {
      tx.update(ref, { recordRef: { kind: "booking", id: bookingId }, ...place, ...stamp(database) });
    }
  }, opts);
  void logActivity("booking.added", { name }, { kind: "booking", id: bookingId }, opts);
  return { bookingId, id };
}

/* ---------- parts ---------- */

/**
 * Split into parts (guide §6.9): what's paid becomes "Deposit" (paid in full),
 * the rest "Balance" with the old due date and next step, or one "First
 * payment" when nothing is paid. Undo takes the parts away again, but refuses
 * with `changed` once any part was edited or paid, since that would be lost.
 */
export async function splitBooking(
  target: RecordTarget,
  opts: WriteOptions = {},
): Promise<Undoable & { partIds: string[] }> {
  // A price, paid or due date typed just before pressing Split is saved first, so the parts take it.
  await afterOwnWrites(opts);
  const done = await patchWithUndo<string[]>(
    collectionOf(target.kind),
    target.id,
    (data) => {
      const booking = bookingOf(target.kind, target.id, data);
      if (booking.parts.length > 0) throw new WriteError("failed", "Already in parts");
      const parts = splitPlan(booking, makeId).map(storedPart);
      // The first part takes what's paid, so it takes the payments behind it too:
      // left at the top level, a payment's undo would take its amount off a
      // booking whose own paid is now 0.
      const history = withElementIds<Element>(data.payments);
      if (history.length > 0) parts[0] = { ...parts[0], payments: history };
      const payments = history.length > 0 ? { payments: [] } : {};
      return { patch: { subEntries: parts, ...singleMoneyCleared(target.kind), ...payments }, result: parts.map((p) => p.id) };
    },
    opts,
  );
  return { undo: done.undo, partIds: done.result ?? [] };
}

/**
 * "Add a part": an empty "Add-on" carrying the funder of the last part (or the
 * booking's). Idempotent by `partId`, so a retry doesn't add two. Undo takes
 * only that part out, so payments recorded on the other parts meanwhile stay.
 */
export async function addPart(
  target: RecordTarget,
  opts: WriteOptions & { partId?: string } = {},
): Promise<Undoable & { partId: string }> {
  const partId = opts.partId ?? makeId();
  let added: Element | null = null;
  await patchWithUndo(
    collectionOf(target.kind),
    target.id,
    (data) => {
      const parts = withElementIds<Element>(data.subEntries);
      if (parts.some((p) => p.id === partId)) return null;
      const last = parts.at(-1);
      const funder = last && "funder" in last ? (last.funder ?? null) : (data.funder ?? null);
      const part = { id: partId, name: "Add-on", funder, totalPrice: 0, budgetSpent: 0, nextTargetDate: null, nextAction: "", files: [] };
      added = part;
      return { patch: { subEntries: [...parts, part] } };
    },
    opts,
  );
  return {
    partId,
    undo: async () => {
      if (added) await removeAddedElement(collectionOf(target.kind), target.id, "subEntries", added, opts);
    },
  };
}

/**
 * A split booking's own price, paid, due date and next step, emptied: once it
 * has parts, they hold the money (as the prototype's split drops them), so
 * removing every part leaves Rp 0 rather than the figures from before the split.
 * A venue's price falls back to its estimate, so it gets an agreed price of 0.
 */
function singleMoneyCleared(kind: BookedKind): Record<string, unknown> {
  const price = kind === "venue" ? { agreedPrice: 0 } : { totalPrice: 0 };
  return { ...price, budgetSpent: 0, nextTargetDate: null, nextAction: "" };
}

/**
 * Removes a booking's part; undo puts it back in its place. Removing the last
 * one also empties the booking's own money (bookings split by the old app kept
 * it), so the booking comes to Rp 0 as the confirm says; undo puts both back.
 */
export async function removePart(target: RecordTarget, partId: string, opts: WriteOptions = {}): Promise<Undoable> {
  const col = collectionOf(target.kind);
  const done = await patchWithUndo(
    col,
    target.id,
    (data) => {
      const parts = withElementIds<Element>(data.subEntries);
      if (parts.length !== 1 || parts[0].id !== partId) return null;
      return { patch: { subEntries: [], ...singleMoneyCleared(target.kind) } };
    },
    opts,
  );
  if (done.changed) return { undo: done.undo };
  return removeElementWithUndo(col, target.id, "subEntries", partId, opts);
}

/* ---------- payments ---------- */

export interface PaymentInput {
  amount: number;
  paidOn: IsoDate | null;
  paidBy: FunderId;
  receiptFileId?: string | null;
}

/**
 * Record a payment (guide §5.4). Adds the amount to what's paid (`budgetSpent`,
 * which stays the total) and keeps the payment in `payments[]` (§9.2 Q5) on
 * the part, or on the booking when it has no parts. Paying more than what's
 * left is allowed and shows as overpaid. One payment per `paymentId`: Try again
 * after a failure that landed after all writes over it, so an amount changed
 * before trying again is the one recorded, and the toast and Undo agree with
 * it. Undo takes that payment back out.
 */
export async function recordPayment(
  target: RecordTarget & { partId?: string | null },
  payment: PaymentInput,
  opts: WriteOptions & { paymentId?: string } = {},
): Promise<Undoable & { paymentId: string }> {
  const amount = Math.round(payment.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new WriteError("failed", "Enter the amount you paid");
  const paymentId = opts.paymentId ?? makeId();
  const entry = {
    id: paymentId,
    amount,
    paidOn: payment.paidOn,
    funder: payment.paidBy,
    receiptFileId: payment.receiptFileId ?? null,
  };
  const col = collectionOf(target.kind);
  let name = "";

  await transact(async (tx, database) => {
    const ref = doc(database, col, target.id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new WriteError("missing", `${col}/${target.id} is gone`);
    const data = snap.data();
    name = String(data.name ?? "");
    // The holder with this payment in it, or null when it's there as it is already.
    const recorded = (holder: Record<string, unknown>) => {
      const history = withElementIds<Element>(holder.payments);
      const earlier = history.find((p) => p.id === paymentId);
      if (earlier && sameValue(earlier, entry)) return null;
      return {
        budgetSpent: num(holder.budgetSpent) - num(earlier?.amount) + amount,
        payments: earlier ? history.map((p) => (p.id === paymentId ? entry : p)) : [...history, entry],
      };
    };
    const parts = withElementIds<Element>(data.subEntries);
    if (target.partId) {
      const index = parts.findIndex((p) => p.id === target.partId);
      if (index < 0) throw new WriteError("missing", `part ${target.partId} is gone`);
      const changed = recorded(parts[index]);
      if (!changed) return;
      parts[index] = { ...parts[index], ...changed };
      tx.update(ref, { subEntries: parts, ...stamp(database) });
    } else {
      if (parts.length > 0) throw new WriteError("failed", "Record the payment on one of its parts");
      const changed = recorded(data);
      if (changed) tx.update(ref, { ...changed, ...stamp(database) });
    }
  }, opts);

  void logActivity(
    "payment.recorded",
    { amount, name },
    { kind: "booking", id: bookingIdOf(target), ...(target.partId ? { partId: target.partId } : {}) },
    opts,
  );

  return {
    paymentId,
    // Refuses with `changed`, writing nothing, when the payment is no longer
    // where it was recorded (the booking was split, its part removed, the
    // payment already taken back) or what's paid has been set below it since.
    undo: () =>
      transact(async (tx, database) => {
        const ref = doc(database, col, target.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new WriteError("missing", `${col}/${target.id} is gone`);
        const data = snap.data();
        const conflict = () => changedSince(`payment ${paymentId}`, data, database);
        const takeOut = (holder: Record<string, unknown>) => {
          const history = withElementIds<Element>(holder.payments);
          const found = history.find((p) => p.id === paymentId);
          const paid = num(holder.budgetSpent) - num(found?.amount);
          if (!found || paid < 0) throw conflict();
          return { budgetSpent: paid, payments: history.filter((p) => p.id !== paymentId) };
        };
        const parts = withElementIds<Element>(data.subEntries);
        if (target.partId) {
          const index = parts.findIndex((p) => p.id === target.partId);
          if (index < 0) throw conflict();
          parts[index] = { ...parts[index], ...takeOut(parts[index]) };
          tx.update(ref, { subEntries: parts, ...stamp(database) });
        } else {
          if (parts.length > 0) throw conflict();
          tx.update(ref, { ...takeOut(data), ...stamp(database) });
        }
      }, opts),
  };
}

/* ---------- removing ---------- */

/**
 * Remove this booking: it leaves the budget, but the vendor or venue stays,
 * and its files stay in Files (§9.2 Q6). Undo brings the booking back.
 */
export async function removeBooking(target: RecordTarget, opts: WriteOptions = {}): Promise<Undoable> {
  let name = "";
  const done = await patchWithUndo(
    collectionOf(target.kind),
    target.id,
    (data) => {
      name = String(data.name ?? "");
      const mark = bookingMark(data.booking);
      if (mark?.removed) return null;
      return {
        patch: { booking: { on: mark?.on ?? null, from: mark?.from ?? target.kind, removed: true } },
      };
    },
    opts,
  );
  if (done.changed) {
    void logActivity("booking.removed", { name }, { kind: "booking", id: bookingIdOf(target) }, opts);
  }
  return done;
}

/**
 * Removing a vendor or venue record (need N10). Until N10 is designed, a
 * record that is a live booking is refused unless `evenIfBooked` is set, so
 * one tap can't take a booking and its payments out of the budget.
 */
function removeRecord(kind: BookedKind, id: string, opts: WriteOptions & { evenIfBooked?: boolean }) {
  return removeWithUndo(collectionOf(kind), id, {
    ...opts,
    guard: (data) => {
      if (!opts.evenIfBooked && isBooked(kind, id, data)) {
        throw new WriteError("failed", "This is a booking. Remove the booking first.");
      }
    },
  });
}

export const removeVendor = (id: string, opts: WriteOptions & { evenIfBooked?: boolean } = {}) =>
  removeRecord("vendor", id, opts);

export const removeVenue = (id: string, opts: WriteOptions & { evenIfBooked?: boolean } = {}) =>
  removeRecord("venue", id, opts);

/* ---------- what-if items (guide §5.10) ---------- */

const WHAT_IF = "hypotheticalItems";

function whatIfPart(id: string, name: string, totalPrice: number, funder: unknown) {
  return { id, name, funder: typeof funder === "string" ? funder : null, totalPrice, budgetSpent: 0, nextTargetDate: null, nextAction: "", files: [] };
}

/**
 * "Part 1" with the item's price and funder, and "Part 2" at Rp 0. The funder moves
 * down into the parts, so the item has none of its own: a part set to Not assigned
 * (stored as null, which reads as "the item's") then really is, as the prototype's
 * split does by deleting the item's `funder`.
 */
export async function splitWhatIf(id: string, opts: WriteOptions = {}): Promise<Undoable & { partIds: string[] }> {
  await afterOwnWrites(opts);
  const done = await patchWithUndo<string[]>(
    WHAT_IF,
    id,
    (data) => {
      if (withElementIds(data.subEntries).length > 0) throw new WriteError("failed", "Already in parts");
      const parts = [
        whatIfPart(makeId(), "Part 1", num(data.totalPrice), data.funder),
        whatIfPart(makeId(), "Part 2", 0, data.funder),
      ];
      return { patch: { subEntries: parts, funder: null }, result: parts.map((p) => p.id) };
    },
    opts,
  );
  return { undo: done.undo, partIds: done.result ?? [] };
}

export async function addWhatIfPart(
  id: string,
  opts: WriteOptions & { partId?: string } = {},
): Promise<Undoable & { partId: string }> {
  const partId = opts.partId ?? makeId();
  let added: Element | null = null;
  await patchWithUndo(
    WHAT_IF,
    id,
    (data) => {
      const parts = withElementIds<Element>(data.subEntries);
      if (parts.some((p) => p.id === partId)) return null;
      const funder = parts.at(-1)?.funder ?? data.funder;
      const part = whatIfPart(partId, `Part ${parts.length + 1}`, 0, funder);
      added = part;
      return { patch: { subEntries: [...parts, part] } };
    },
    opts,
  );
  return {
    partId,
    undo: async () => {
      if (added) await removeAddedElement(WHAT_IF, id, "subEntries", added, opts);
    },
  };
}

/**
 * Removes a what-if part. Removing down to one part merges it back into a
 * single item that takes that part's price and funder.
 */
export async function removeWhatIfPart(id: string, partId: string, opts: WriteOptions = {}): Promise<Undoable> {
  return patchWithUndo(
    WHAT_IF,
    id,
    (data) => {
      const parts = withElementIds<Element>(data.subEntries);
      if (!parts.some((p) => p.id === partId)) return null;
      const rest = parts.filter((p) => p.id !== partId);
      if (rest.length === 1) {
        const [only] = rest;
        return {
          patch: {
            subEntries: [],
            totalPrice: num(only.totalPrice),
            funder: typeof only.funder === "string" ? only.funder : (data.funder ?? null),
          },
        };
      }
      return { patch: { subEntries: rest } };
    },
    opts,
  );
}

export async function removeWhatIf(id: string, opts: WriteOptions = {}) {
  return removeWithUndo(WHAT_IF, id, opts);
}
