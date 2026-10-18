"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useBookingList } from "@/lib/data/use-booking-list";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { BookingsView } from "./bookings-view";

/**
 * Bookings (guide §5.5, B1, B3, B5, B9, B12). Loading, failed, offline and
 * demonstration mode come from the shared screen state. A `?q=` in the address
 * starts the search (Who pays links here for Not assigned).
 */
export function Bookings() {
  const read = useBookingList();
  const initialQuery = useInitialQuery();
  return (
    <PageColumn width="wide">
      <ScreenState read={read} what="the bookings" onRetry={() => window.location.reload()}>
        {(list) => <BookingsView list={list} initialQuery={initialQuery} />}
      </ScreenState>
    </PageColumn>
  );
}

/**
 * The search in `?q=`, read once when the screen opens. The address is then
 * cleared, as the schedule clears `?event=`, so going back doesn't bring it back.
 */
function useInitialQuery(): string {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [initial] = useState(() => params.get("q") ?? "");
  useEffect(() => {
    if (params.has("q")) router.replace(pathname);
  }, [params, pathname, router]);
  return initial;
}
