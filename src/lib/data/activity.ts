import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { deviceId, deviceKind } from "./device";
import { requireDb, uidOf } from "./db";
import { guarded, type WriteOptions } from "./write";

/**
 * Partner news (guide §6.3): after each user-level change, one entry in
 * `activity` says who did what to which record. The partner's screen turns
 * it into the toast ("Bella recorded Rp 55.500.000 for …"); the words are
 * built there from `kind` and `params`, never stored.
 */
export type ActivityKind =
  | "payment.recorded"
  | "booking.added"
  | "booking.split"
  | "booking.removed"
  | "vendor.added"
  | "vendor.removed"
  | "vendor.booked"
  | "finalist.added"
  | "finalist.removed"
  | "finalist.booked"
  | "venue.added"
  | "venue.booked"
  | "whatif.added"
  | "document.added"
  | "file.uploaded"
  | "event.added"
  | "task.finished"
  | "guest.replied"
  | "item.confirmed"
  | (string & {});

export interface ActivityTarget {
  kind: string;
  id: string;
  partId?: string;
}

export type ActivityParams = Record<string, string | number | boolean | null>;

/**
 * Writes the entry. A failure here never fails the change it describes, so it
 * resolves false instead of throwing.
 */
export async function logActivity(
  kind: ActivityKind,
  params: ActivityParams,
  target: ActivityTarget | null,
  opts: WriteOptions = {},
): Promise<boolean> {
  try {
    const database = requireDb(opts.db);
    const ref = doc(collection(database, "activity"));
    // `device` lets the same account's other device tell this change from its own (N3).
    const entry = {
      by: uidOf(database),
      at: serverTimestamp(),
      kind,
      params,
      target,
      device: deviceId(),
      deviceKind: deviceKind(),
    };
    await guarded(() => setDoc(ref, entry));
    return true;
  } catch (err) {
    console.warn("Couldn't record activity:", err);
    return false;
  }
}
