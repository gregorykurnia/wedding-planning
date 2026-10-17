"use client";

import { useEffect, useState } from "react";
import type { IsoDate } from "@/lib/model/bookings";
import { localIso } from "@/lib/model/dates";

/**
 * Milliseconds from `now` to the next local midnight, plus a second, so the
 * timer never fires before the day has turned.
 */
export function msUntilMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime() + 1000;
}

/**
 * Today on this device as `YYYY-MM-DD`. It moves on at local midnight, so a
 * screen left open overnight counts from the new day: the model takes the day
 * as a plain date and works out late and soon against it on each read.
 */
export function useToday(): IsoDate {
  const [today, setToday] = useState(() => localIso(new Date()));
  useEffect(() => {
    const timer = setTimeout(() => setToday(localIso(new Date())), msUntilMidnight(new Date()));
    return () => clearTimeout(timer);
  }, [today]);
  return today;
}
