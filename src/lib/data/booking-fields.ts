import type { FunderId, IsoDate, Rupiah } from "@/lib/model/bookings";
import { collectionOf, setVenueEstimate, type RecordTarget } from "./bookings";
import { updateElement } from "./array-ops";
import { update, type WriteOptions } from "./write";

/**
 * The fields a booking's screen saves as you go (guide §5.6, §6.1). Each saves
 * one field by the stored names the old UI reads (`totalPrice`, `budgetSpent`,
 * `nextTargetDate`, `nextAction`; plan §2.7), and the last write wins, as for a
 * vendor's fields.
 */

export interface BookingFields {
  name: string;
  /** A vendor's category. A venue's is always Venue. */
  category: string;
  /** The agreed price of a booking with no parts. */
  price: Rupiah;
  /** What you noted while comparing; blank is no estimate. */
  estimate: Rupiah | null;
  paid: Rupiah;
  funder: FunderId;
  due: IsoDate | null;
  step: string;
}

/** The part's own fields; a part has no category or estimate. */
export type PartFields = Pick<BookingFields, "name" | "price" | "paid" | "funder" | "due" | "step">;

function storedBooking(kind: RecordTarget["kind"], field: keyof BookingFields, value: unknown): Record<string, unknown> {
  switch (field) {
    case "name":
      return { name: value };
    // Category and the old UI's confirmed type are one thing (see `renameCategory`).
    case "category":
      return { category: value, confirmedType: value };
    case "price":
      return kind === "venue" ? { agreedPrice: value } : { totalPrice: value };
    // A venue's goes through `setVenueEstimate`.
    case "estimate":
      return { estimate: value };
    case "paid":
      return { budgetSpent: value };
    case "funder":
      return { funder: value };
    case "due":
      return { nextTargetDate: value };
    case "step":
      return { nextAction: value };
  }
}

export function setBookingField<K extends keyof BookingFields>(
  target: RecordTarget,
  field: K,
  value: BookingFields[K],
  opts: WriteOptions = {},
): Promise<void> {
  if (field === "estimate" && target.kind === "venue") return setVenueEstimate(target.id, value as number | null, opts);
  return update(collectionOf(target.kind), target.id, storedBooking(target.kind, field, value), opts);
}

const STORED_PART: Record<keyof PartFields, string> = {
  name: "name",
  price: "totalPrice",
  paid: "budgetSpent",
  funder: "funder",
  due: "nextTargetDate",
  step: "nextAction",
};

/** Saves one field of one part, inside the record as it is now, so another part's change in the meantime stays. */
export async function setPartField<K extends keyof PartFields>(
  target: RecordTarget,
  partId: string,
  field: K,
  value: PartFields[K],
  opts: WriteOptions = {},
): Promise<void> {
  await updateElement(collectionOf(target.kind), target.id, "subEntries", partId, { [STORED_PART[field]]: value }, opts);
}
