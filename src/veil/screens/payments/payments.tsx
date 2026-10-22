"use client";

import { useMemo } from "react";
import { mergeStatus } from "@/lib/data/read";
import type { Loaded } from "@/lib/data/settings";
import { useDues } from "@/lib/data/use-budget";
import { useBookings } from "@/lib/data/use-bookings";
import { useFunders } from "@/lib/data/use-funders";
import { useToday } from "@/lib/data/use-today";
import { useRecordPayment } from "@/veil/parts/payment/use-record-payment";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { PaymentsView, type PaymentsList } from "./payments-view";

/** The payments due with the funders' names and today, under one status. Null data in demonstration mode. */
function usePaymentsList(): Loaded<PaymentsList> {
  const today = useToday();
  const dues = useDues();
  const bookings = useBookings();
  const funders = useFunders();
  const status = mergeStatus(dues, bookings, funders);
  const data = useMemo<PaymentsList | null>(() => {
    if (!dues.data || !bookings.data || !funders.data) return null;
    return { today, dues: dues.data, funders: funders.data.funders, hasBookings: bookings.data.length > 0 };
  }, [today, dues.data, bookings.data, funders.data]);
  return { status, data: status === "demo" ? null : data };
}

/**
 * Payments due (guide §5.8, B6, S6, O2). Loading, failed, offline and
 * demonstration mode come from the shared screen state; Record payment opens the
 * shared sheet for the booking, or for the one part that is due.
 */
export function Payments() {
  const read = usePaymentsList();
  const recordPayment = useRecordPayment();
  return (
    <PageColumn>
      <ScreenState read={read} what="payments due" onRetry={() => window.location.reload()}>
        {(list) => <PaymentsView list={list} onRecord={recordPayment} />}
      </ScreenState>
    </PageColumn>
  );
}
