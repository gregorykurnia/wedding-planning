import type { FunderId, IsoDate } from "./bookings";
import { OTHER_CATEGORY } from "./categories";
import { isIsoDate } from "./dates";

// The add-a-booking form (guide §5.7, B2): its words, and what it sends when
// Add booking is pressed. A booking added here is a vendor record with
// `booking.from = "direct"`, written by `addDirectBooking`.

export const BOOKING_SUB =
  "For something you’ve booked that didn’t go through Vendors or Venues. Those become bookings by themselves.";
export const NAME_MISSING = "Give the booking a name so you can find it later.";
export const ADD_FAILED = "The booking wasn’t added: the planner lost its connection. Everything you entered is still here.";
export const DEMO_ADDING = "Demonstration mode: adding is turned off.";
export const NOT_ASSIGNED = "Not assigned";
export const CHOOSE_CATEGORY = "Choose a category";
export const INSTALMENTS_NOTE = "Paying in instalments? Add the booking first, then split it into parts.";
export const ATTACH_FILE = "Attach a contract or receipt";
export const FILES_WAITING = "Waiting for the files to finish uploading.";
export const FILE_FAILED = "A file didn’t upload. Try again to add the booking with it.";
export const ADD_BOOKING = "Add booking";
export const ADDING = "Adding";
export const TRY_AGAIN = "Try again";
export const addedText = (name: string) => `Added ${name}`;

/** What the form holds. Price and paid are null while blank; the category is "" until one is chosen. */
export interface DirectBookingForm {
  name: string;
  category: string;
  price: number | null;
  paid: number | null;
  funder: FunderId;
  due: string;
  step: string;
  /** The `weddingFiles` ids of the files attached, all uploaded. */
  files: readonly string[];
}

/** What `addDirectBooking` takes. */
export interface DirectBookingDraft {
  name: string;
  category: string;
  price: number;
  paid: number;
  funder: FunderId;
  due: IsoDate | null;
  step: string;
  files: readonly string[];
}

/** The line under the name field when Add is pressed without one, or null when there is a name. */
export function nameProblem(name: string): string | null {
  return name.trim() ? null : NAME_MISSING;
}

/** The form as the write takes it: trimmed text, a blank category as Other, blank amounts as zero. */
export function directBookingDraft(form: DirectBookingForm): DirectBookingDraft {
  return {
    name: form.name.trim(),
    category: form.category || OTHER_CATEGORY,
    price: form.price ?? 0,
    paid: form.paid ?? 0,
    funder: form.funder,
    due: isIsoDate(form.due) ? form.due : null,
    step: form.step.trim(),
    files: form.files,
  };
}
