/**
 * Bookings derived from vendor and venue records (guide §6.9, inventory B1–B4, B12).
 *
 * Pure functions over plain objects: no Firebase, no React. A booking is a
 * vendor or venue with `booking` set and not removed. Records written before
 * migration 1.11 have no `booking` field, so they fall back to the old rule:
 * a vendor at Chosen or Done, or a venue at Booked. Every booked venue counts
 * (inventory-notes §5 #1).
 */

/** Money is whole rupiah. */
export type Rupiah = number;

/** A `YYYY-MM-DD` date in the local calendar. */
export type IsoDate = string;

/** The id of a `funders` document; `null` is Not assigned. */
export type FunderId = string | null;

export interface BookingMark {
  on: IsoDate | null;
  from: "vendor" | "venue" | "finalist" | "direct";
  removed: boolean;
}

/** A stored sub-entry. A missing `funder` key means "inherit the parent's" (legacy). */
export interface PartRecord {
  id: string;
  name: string;
  funder?: FunderId;
  totalPrice: Rupiah;
  budgetSpent: Rupiah;
  nextTargetDate: IsoDate | null;
  nextAction: string;
}

export interface VendorRecord {
  id: string;
  name: string;
  category: string;
  contractStatus: string;
  funder: FunderId;
  totalPrice: Rupiah;
  budgetSpent: Rupiah;
  nextTargetDate: IsoDate | null;
  nextAction: string;
  subEntries: PartRecord[];
  priceOptions?: { price: Rupiah; selected: boolean }[];
  booking?: BookingMark | null;
  estimate?: Rupiah | null;
}

export interface VenueRecord {
  id: string;
  name: string;
  status: string;
  funder: FunderId;
  budgetEstimate: Rupiah;
  agreedPrice?: Rupiah | null;
  budgetSpent: Rupiah;
  nextTargetDate: IsoDate | null;
  nextAction: string;
  subEntries: PartRecord[];
  booking?: BookingMark | null;
}

/** One payable line: a part of a booking, or the booking itself when it has no parts. */
export interface Part {
  /** `null` for the single line of a booking with no parts. */
  id: string | null;
  name: string;
  price: Rupiah;
  paid: Rupiah;
  funder: FunderId;
  due: IsoDate | null;
  step: string;
}

export interface Booking {
  /** `vendor-<id>` or `venue-<id>`, as used in URLs. */
  id: string;
  kind: "vendor" | "venue";
  recordId: string;
  name: string;
  category: string;
  /** The booking's own values. Read-only once it has parts (§5 #3). */
  price: Rupiah;
  paid: Rupiah;
  funder: FunderId;
  due: IsoDate | null;
  step: string;
  parts: Part[];
  /** The comparison estimate, kept apart from the agreed price (B12). */
  estimate: Rupiah | null;
  bookedOn: IsoDate | null;
  from: BookingMark["from"] | null;
  /** Added on "Add a booking"; left out of the Vendors list. */
  direct: boolean;
}

const LEGACY_VENDOR_BOOKED = new Set(["Chosen", "Done"]);

/** Whole rupiah: anything that isn't a finite number reads as 0. */
export const rupiah = (n: unknown): Rupiah =>
  typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0;

const dateOrNull = (d: unknown): IsoDate | null => (typeof d === "string" && d ? d : null);

export function isVendorBooked(v: VendorRecord): boolean {
  if (v.booking !== undefined) return v.booking !== null && !v.booking.removed;
  return LEGACY_VENDOR_BOOKED.has(v.contractStatus);
}

export function isVenueBooked(v: VenueRecord): boolean {
  if (v.booking !== undefined) return v.booking !== null && !v.booking.removed;
  return v.status === "Booked";
}

function partsFrom(records: PartRecord[] | undefined, parentFunder: FunderId): Part[] {
  return (records ?? []).map((p) => ({
    id: p.id,
    name: p.name ?? "",
    price: rupiah(p.totalPrice),
    paid: rupiah(p.budgetSpent),
    funder: p.funder === undefined ? parentFunder : p.funder,
    due: dateOrNull(p.nextTargetDate),
    step: p.nextAction ?? "",
  }));
}

function selectedOptionPrice(v: VendorRecord): Rupiah | null {
  const option = v.priceOptions?.find((o) => o.selected);
  return option ? rupiah(option.price) : null;
}

export function bookingFromVendor(v: VendorRecord): Booking {
  const estimate =
    typeof v.estimate === "number" ? rupiah(v.estimate) : selectedOptionPrice(v);
  return {
    id: `vendor-${v.id}`,
    kind: "vendor",
    recordId: v.id,
    name: v.name,
    category: v.category,
    price: rupiah(v.totalPrice),
    paid: rupiah(v.budgetSpent),
    funder: v.funder ?? null,
    due: dateOrNull(v.nextTargetDate),
    step: v.nextAction ?? "",
    parts: partsFrom(v.subEntries, v.funder ?? null),
    estimate,
    bookedOn: v.booking?.on ?? null,
    from: v.booking?.from ?? null,
    direct: v.booking?.from === "direct",
  };
}

export function bookingFromVenue(v: VenueRecord): Booking {
  // Until a venue has its own agreed price, the old app kept the price in
  // `budgetEstimate`, so both read from it (§5 #5).
  const price = typeof v.agreedPrice === "number" ? v.agreedPrice : v.budgetEstimate;
  return {
    id: `venue-${v.id}`,
    kind: "venue",
    recordId: v.id,
    name: v.name,
    category: "Venue",
    price: rupiah(price),
    paid: rupiah(v.budgetSpent),
    funder: v.funder ?? null,
    due: dateOrNull(v.nextTargetDate),
    step: v.nextAction ?? "",
    parts: partsFrom(v.subEntries, v.funder ?? null),
    estimate: typeof v.budgetEstimate === "number" ? rupiah(v.budgetEstimate) : null,
    bookedOn: v.booking?.on ?? null,
    from: v.booking?.from ?? null,
    direct: false,
  };
}

/** Every booked venue, then every booked vendor, in the order given. */
export function bookingsFrom(vendors: VendorRecord[], venues: VenueRecord[]): Booking[] {
  return [
    ...venues.filter(isVenueBooked).map(bookingFromVenue),
    ...vendors.filter(isVendorBooked).map(bookingFromVendor),
  ];
}

/** The payable lines of a booking: its parts, or one line for the booking itself. */
export function partsOf(b: Booking): Part[] {
  if (b.parts.length > 0) return b.parts;
  return [{ id: null, name: b.name, price: b.price, paid: b.paid, funder: b.funder, due: b.due, step: b.step }];
}
