import type {
  BookingMark,
  FunderId,
  PartRecord,
  VendorRecord,
  VenueRecord,
} from "@/lib/model/bookings";
import { withElementIds } from "@/lib/data/array-ops";
import { isObject, legacyFiles, millis, num, numOrNull, str, strOrNull, type LegacyFile } from "./common";

const BOOKING_FROM = new Set<BookingMark["from"]>(["vendor", "venue", "finalist", "direct"]);

/**
 * `booking` as stored. Missing means "not migrated yet", so the model falls
 * back to the old status rule; `null` means not booked.
 */
export function bookingMark(raw: unknown): BookingMark | null | undefined {
  if (raw === undefined) return undefined;
  if (!isObject(raw)) return null;
  const from = BOOKING_FROM.has(raw.from as BookingMark["from"]) ? (raw.from as BookingMark["from"]) : "vendor";
  return { on: strOrNull(raw.on), from, removed: raw.removed === true };
}

const funderOf = (v: unknown): FunderId => (typeof v === "string" && v ? v : null);

export interface PaymentRecord {
  id: string;
  amount: number;
  paidOn: string | null;
  funder: FunderId;
  receiptFileId: string | null;
}

export function payments(raw: unknown): PaymentRecord[] {
  return withElementIds<Record<string, unknown>>(raw).map((p) => ({
    id: p.id,
    amount: num(p.amount),
    paidOn: strOrNull(p.paidOn),
    funder: funderOf(p.funder),
    receiptFileId: strOrNull(p.receiptFileId),
  }));
}

export interface StoredPart extends PartRecord {
  files: LegacyFile[];
  payments: PaymentRecord[];
}

/** Parts keep a missing `funder` key missing: it means "the booking's funder" (legacy). */
export function parts(raw: unknown): StoredPart[] {
  return withElementIds<Record<string, unknown>>(raw).map((p) => ({
    id: p.id,
    name: str(p.name),
    ...("funder" in p ? { funder: funderOf(p.funder) } : {}),
    totalPrice: num(p.totalPrice),
    budgetSpent: num(p.budgetSpent),
    nextTargetDate: strOrNull(p.nextTargetDate),
    nextAction: str(p.nextAction),
    files: legacyFiles(p.files),
    payments: payments(p.payments),
  }));
}

export interface PriceOption {
  id: string;
  description: string;
  price: number;
  /** The one we're leaning towards. */
  selected: boolean;
}

export interface VendorDoc extends VendorRecord {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
  keen: boolean;
  rating: number | null;
  reviewers: number | null;
  priceOptions: PriceOption[];
  subEntries: StoredPart[];
  files: LegacyFile[];
  payments: PaymentRecord[];
  createdAt: number | null;
  updatedAt: number | null;
  updatedBy: string | null;
}

export function vendorFromDoc(id: string, data: Record<string, unknown>): VendorDoc {
  const booking = bookingMark(data.booking);
  return {
    id,
    name: str(data.name),
    category: str(data.category) || "Other",
    contractStatus: str(data.contractStatus) || "Inquiring",
    funder: funderOf(data.funder),
    totalPrice: num(data.totalPrice),
    budgetSpent: num(data.budgetSpent),
    nextTargetDate: strOrNull(data.nextTargetDate),
    nextAction: str(data.nextAction),
    subEntries: parts(data.subEntries),
    priceOptions: withElementIds<Record<string, unknown>>(data.priceOptions).map((o) => ({
      id: o.id,
      description: str(o.description),
      price: num(o.price),
      selected: o.selected === true,
    })),
    ...(booking !== undefined ? { booking } : {}),
    estimate: numOrNull(data.estimate),
    contactName: str(data.contactName),
    contactPhone: str(data.contactPhone),
    contactEmail: str(data.contactEmail),
    notes: str(data.notes),
    keen: data.starred === true,
    rating: numOrNull(data.bridestoryRating),
    reviewers: numOrNull(data.bridestoryReviewCount),
    files: legacyFiles(data.files),
    payments: payments(data.payments),
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
    updatedBy: strOrNull(data.updatedBy),
  };
}

export interface VenueDoc extends VenueRecord {
  guestMax: number;
  location: string;
  notes: string;
  subEntries: StoredPart[];
  files: LegacyFile[];
  payments: PaymentRecord[];
  createdAt: number | null;
  updatedAt: number | null;
  updatedBy: string | null;
}

export function venueFromDoc(id: string, data: Record<string, unknown>): VenueDoc {
  const booking = bookingMark(data.booking);
  return {
    id,
    name: str(data.name),
    status: str(data.status) || "Shortlist",
    funder: funderOf(data.funder),
    budgetEstimate: num(data.budgetEstimate),
    agreedPrice: numOrNull(data.agreedPrice),
    budgetSpent: num(data.budgetSpent),
    nextTargetDate: strOrNull(data.nextTargetDate),
    nextAction: str(data.nextAction),
    subEntries: parts(data.subEntries),
    ...(booking !== undefined ? { booking } : {}),
    guestMax: num(data.guestMax),
    location: str(data.location),
    notes: str(data.notes),
    files: legacyFiles(data.files),
    payments: payments(data.payments),
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
    updatedBy: strOrNull(data.updatedBy),
  };
}
