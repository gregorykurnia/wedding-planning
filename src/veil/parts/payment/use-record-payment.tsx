"use client";

import { useCallback, useState } from "react";
import { recordPayment } from "@/lib/data/bookings";
import { useBookings } from "@/lib/data/use-bookings";
import { useFunders } from "@/lib/data/use-funders";
import type { Booking } from "@/lib/model/bookings";
import { useSheets } from "@/veil/shell/sheet";
import { RecordPaymentSheet, type RecordFn } from "./record-payment-sheet";

/** The real write: `recordPayment` on the booking's vendor or venue, with its part when it has one. */
const recordForReal =
  (booking: Booking): RecordFn =>
  (entry, { partId, paymentId }) =>
    recordPayment({ kind: booking.kind, id: booking.recordId, partId }, entry, { paymentId });

/**
 * The sheet as a screen opens it. It reads the booking and the funders live, so
 * a payment the partner records while the sheet is open moves the preview line;
 * a booking that disappears keeps the last one seen, and recording it then
 * fails the way any write to a missing record does.
 */
function LiveRecordPayment({ booking, partId }: { booking: Booking; partId: string | null }) {
  const bookings = useBookings();
  const funders = useFunders();
  const found = bookings.data?.find((b) => b.id === booking.id);
  const [latest, setLatest] = useState(booking);
  // Kept as state, so the last booking seen outlasts the booking leaving the read.
  if (found && found !== latest) setLatest(found);
  return (
    <RecordPaymentSheet
      booking={found ?? latest}
      partId={partId}
      funders={funders.data?.funders ?? []}
      record={recordForReal(booking)}
    />
  );
}

/**
 * Opens Record a payment over the current screen (guide §5.4). The budget, a
 * booking, a part, payments due and the agenda each call it: give it the
 * booking, and the part when the press was on one (without a part, a booking in
 * parts takes its next step).
 */
export function useRecordPayment(): (booking: Booking, partId?: string | null) => void {
  const sheets = useSheets();
  return useCallback(
    (booking, partId = null) => {
      sheets.open(<LiveRecordPayment booking={booking} partId={partId} />);
    },
    [sheets],
  );
}
