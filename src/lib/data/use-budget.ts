"use client";

import { useMemo } from "react";
import type { IsoDate, Rupiah } from "@/lib/model/bookings";
import { budget, dues, whatIfTotal, type Budget, type Due, type Funder } from "@/lib/model/money";
import { mergeStatus } from "./read";
import { useSettings, type Loaded } from "./settings";
import { useBookings } from "./use-bookings";
import { useFunderTotals } from "./use-funders";
import { useToday } from "./use-today";
import { useWhatIf } from "./use-what-if";

/** What's booked, paid and still to pay (guide §6.9). */
export function useBudget(): Loaded<Budget> {
  const bookings = useBookings();
  const data = useMemo(() => (bookings.data ? budget(bookings.data) : null), [bookings.data]);
  return { status: bookings.status, data };
}

/** Every dated payment still owed, earliest first, worked out against today. */
export function useDues(): Loaded<Due[]> {
  const bookings = useBookings();
  const today = useToday();
  const data = useMemo(() => (bookings.data ? dues(bookings.data, today) : null), [bookings.data, today]);
  return { status: bookings.status, data };
}

/** Everything the budget screen reads, joined into one set of numbers. */
export interface BudgetOverview {
  /** Today as `YYYY-MM-DD`: late and soon are worked out against it. */
  today: IsoDate;
  /** The wedding date, or null until it's set. */
  weddingDate: IsoDate | null;
  budget: Budget;
  dues: Due[];
  /** The funders in their own order, Not assigned left out. */
  funders: Funder[];
  /** What Not assigned still has to pay. */
  notAssignedLeft: Rupiah;
  whatIfCount: number;
  /** The committed price plus every what-if item: the total they would bring. */
  projectedTotal: Rupiah;
}

/**
 * The budget screen's read (guide §5.4): the budget, the payments due, the
 * funders, the what-if items and the wedding date, joined under one status.
 * Demonstration mode has no data, so the result is null there.
 */
export function useBudgetOverview(): Loaded<BudgetOverview> {
  const today = useToday();
  const totals = useBudget();
  const dueList = useDues();
  const funders = useFunderTotals();
  const whatIfs = useWhatIf();
  const settings = useSettings();
  const status = mergeStatus(totals, dueList, funders, whatIfs, settings);
  const data = useMemo<BudgetOverview | null>(() => {
    if (!totals.data || !dueList.data || !funders.data || !whatIfs.data || !settings.data) return null;
    const rows = funders.data.rows;
    return {
      today,
      weddingDate: settings.data.weddingDate,
      budget: totals.data,
      dues: dueList.data,
      funders: rows.flatMap((r) => (r.id === null ? [] : [{ id: r.id, name: r.name }])),
      notAssignedLeft: rows.find((r) => r.id === null)?.left ?? 0,
      whatIfCount: whatIfs.data.length,
      projectedTotal: totals.data.price + whatIfs.data.reduce((sum, w) => sum + whatIfTotal(w), 0),
    };
  }, [today, totals.data, dueList.data, funders.data, whatIfs.data, settings.data]);
  return { status, data: status === "demo" ? null : data };
}
