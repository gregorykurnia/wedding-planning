"use client";

import { useMemo } from "react";
import { useFunderDocs } from "@/lib/collections/funders";
import { fundersFrom } from "@/lib/data/adapters/funders";
import { budget, byFunder, type Budget, type Funder, type FunderRow } from "@/lib/model/money";
import { mergeStatus, readOf } from "./read";
import { useSession } from "./session";
import type { Loaded } from "./settings";
import { useBookings } from "./use-bookings";

export interface FunderList {
  /** In their own order. The four old funders stand in until migration has seeded the collection. */
  funders: Funder[];
  /** The `order` for a funder added now: after every one that exists. */
  nextOrder: number;
}

export function useFunders(): Loaded<FunderList> {
  const docs = useFunderDocs();
  const { connection } = useSession();
  const list = useMemo<FunderList>(
    () => ({
      funders: fundersFrom(docs.data),
      nextOrder: docs.data.reduce((top, f) => Math.max(top, f.order), -1) + 1,
    }),
    [docs.data],
  );
  return readOf(connection, [docs], list);
}

export interface FunderTotals {
  /** One row per funder, then Not assigned (guide §5.9). */
  rows: FunderRow[];
  /** The budget's own totals, which the rows always add up to. */
  budget: Budget;
  hasBookings: boolean;
  nextOrder: number;
}

/** What each funder has paid and still owes, for Who pays. */
export function useFunderTotals(): Loaded<FunderTotals> {
  const funders = useFunders();
  const bookings = useBookings();
  const status = mergeStatus(funders, bookings);
  const data = useMemo<FunderTotals | null>(
    () =>
      funders.data && bookings.data
        ? {
            rows: byFunder(bookings.data, funders.data.funders),
            budget: budget(bookings.data),
            hasBookings: bookings.data.length > 0,
            nextOrder: funders.data.nextOrder,
          }
        : null,
    [funders.data, bookings.data],
  );
  return { status, data: status === "demo" ? null : data };
}
