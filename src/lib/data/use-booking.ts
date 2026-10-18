"use client";

import { useMemo } from "react";
import { vendorFromDoc, venueFromDoc, type VendorDoc, type VenueDoc } from "@/lib/data/adapters/bookings";
import { fileFromDoc, filesForRecord, type FileDoc, type RecordRef } from "@/lib/data/adapters/files";
import {
  bookingFromVendor,
  bookingFromVenue,
  isVendorBooked,
  isVenueBooked,
  type Booking,
  type IsoDate,
} from "@/lib/model/bookings";
import type { Funder } from "@/lib/model/money";
import { useCollection } from "@/lib/use-collection";
import { parseBookingId } from "./bookings";
import { mergeStatus, readOf } from "./read";
import { useSession } from "./session";
import type { Loaded } from "./settings";
import { useFunders } from "./use-funders";
import { useToday } from "./use-today";
import { useCategories } from "./vendors";

/** A file on a booking or on one of its parts, as `FileTiles` takes it. */
export interface BookingFile {
  id: string | null;
  name: string;
  url: string;
  size: number | null;
  mime: string;
  /** Came with the vendor or venue it was booked from, not uploaded on the booking. */
  fromVendor: boolean;
}

/** What a booking's screen reads (guide §5.6). */
export interface BookingPage {
  today: IsoDate;
  /** Null when there is no such booking here (an old link), or it was removed. */
  booking: Booking | null;
  funders: Funder[];
  /** For the category select; the booking's own category is in it even if it isn't a known one. */
  categories: string[];
  files: BookingFile[];
  /** The files on each part, by the part's id. */
  partFiles: Record<string, BookingFile[]>;
}

/**
 * One booking with what its screen shows beside it: the funders, the category
 * list and the files (Files first, then legacy ones not imported yet). A
 * booking's files include those of the vendor or venue it came from (plan
 * §2.7). A booking that was removed reads as not being here.
 */
export function useBooking(bookingId: string): Loaded<BookingPage> {
  const { connection } = useSession();
  const today = useToday();
  const vendors = useCollection<VendorDoc>("vendors", vendorFromDoc, []);
  const venues = useCollection<VenueDoc>("venues", venueFromDoc, []);
  const files = useCollection<FileDoc>("weddingFiles", fileFromDoc, []);
  const funders = useFunders();
  const categories = useCategories();

  const page = useMemo<BookingPage>(() => {
    const known = categories.data?.list ?? [];
    const base = { today, funders: funders.data?.funders ?? [], categories: known, files: [], partFiles: {} };
    const target = parseBookingId(bookingId);
    if (!target) return { ...base, booking: null };
    const record =
      target.kind === "vendor"
        ? vendors.data.find((v) => v.id === target.id)
        : venues.data.find((v) => v.id === target.id);
    if (!record) return { ...base, booking: null };
    const booked = target.kind === "vendor" ? isVendorBooked(record as VendorDoc) : isVenueBooked(record as VenueDoc);
    if (!booked) return { ...base, booking: null };
    const booking = target.kind === "vendor" ? bookingFromVendor(record as VendorDoc) : bookingFromVenue(record as VenueDoc);

    const byId = new Map(files.data.map((f) => [f.id, f]));
    const tiles = (refs: RecordRef[], legacy: unknown): BookingFile[] => {
      const direct = new Set(filesForRecord([refs[0]], files.data, []).map((f) => f.id));
      return filesForRecord(refs, files.data, legacy).map((f) => {
        const stored = f.id ? byId.get(f.id) : undefined;
        return {
          id: f.id,
          name: f.name,
          url: f.url,
          size: stored?.fileSize || null,
          mime: stored?.fileType ?? "",
          fromVendor: booking.direct ? false : f.id === null || !direct.has(f.id),
        };
      });
    };
    const recordRef = (partId?: string): RecordRef => ({ kind: target.kind, id: target.id, ...(partId ? { partId } : {}) });
    const bookingRef = (partId?: string): RecordRef => ({ kind: "booking", id: bookingId, ...(partId ? { partId } : {}) });
    const partFiles: Record<string, BookingFile[]> = {};
    for (const part of record.subEntries) {
      partFiles[part.id] = tiles([bookingRef(part.id), recordRef(part.id)], part.files);
    }
    return {
      ...base,
      booking,
      categories: known.includes(booking.category) || booking.kind === "venue" ? known : [...known, booking.category],
      files: tiles([bookingRef(), recordRef()], record.files),
      partFiles,
    };
  }, [bookingId, vendors.data, venues.data, files.data, funders.data, categories.data, today]);

  const status = mergeStatus(readOf(connection, [vendors, venues, files], page), funders, categories);
  return { status, data: status === "demo" ? null : page };
}
