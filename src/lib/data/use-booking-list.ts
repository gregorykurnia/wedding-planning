"use client";

import { useMemo } from "react";
import type { Booking, IsoDate } from "@/lib/model/bookings";
import { budget, type Budget, type Funder } from "@/lib/model/money";
import { mergeStatus } from "./read";
import type { Loaded } from "./settings";
import { useBookings } from "./use-bookings";
import { useFunders } from "./use-funders";
import { useToday } from "./use-today";

/** What the Bookings screen reads (guide §5.5): the bookings, the funders for their names, and today. */
export interface BookingList {
  /** Today as `YYYY-MM-DD`: a booking's late part is worked out against it. */
  today: IsoDate;
  bookings: Booking[];
  /** The count and the total committed, for the line under the title. */
  committed: Budget;
  /** Every funder in their own order; a funder that isn't listed reads as Not assigned. */
  funders: Funder[];
}

/**
 * The bookings with the funders and today, under one status. Demonstration mode
 * has no data, so the result is null there.
 */
export function useBookingList(): Loaded<BookingList> {
  const today = useToday();
  const bookings = useBookings();
  const funders = useFunders();
  const status = mergeStatus(bookings, funders);
  const data = useMemo<BookingList | null>(() => {
    if (!bookings.data || !funders.data) return null;
    return {
      today,
      bookings: bookings.data,
      committed: budget(bookings.data),
      funders: funders.data.funders,
    };
  }, [today, bookings.data, funders.data]);
  return { status, data: status === "demo" ? null : data };
}
