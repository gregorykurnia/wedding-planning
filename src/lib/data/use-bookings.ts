"use client";

import { useMemo } from "react";
import { venueFromDoc, vendorFromDoc, type VendorDoc, type VenueDoc } from "@/lib/data/adapters/bookings";
import { bookingsFrom, type Booking } from "@/lib/model/bookings";
import { useCollection } from "@/lib/use-collection";
import { readOf } from "./read";
import { useSession } from "./session";
import type { Loaded } from "./settings";

/**
 * Every booking: the booked vendors and venues, read live and put through the
 * model (guide §6.9). No order is asked of Firestore, since an ordered query
 * leaves out documents that lack the field.
 */
export function useBookings(): Loaded<Booking[]> {
  const vendors = useCollection<VendorDoc>("vendors", vendorFromDoc, []);
  const venues = useCollection<VenueDoc>("venues", venueFromDoc, []);
  const { connection } = useSession();
  const bookings = useMemo(() => bookingsFrom(vendors.data, venues.data), [vendors.data, venues.data]);
  return readOf(connection, [vendors, venues], bookings);
}
