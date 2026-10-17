"use client";

import { useEffect, useState } from "react";
import type { IsoDate } from "@/lib/model/bookings";
import { localIso } from "@/lib/model/dates";

const MIDNIGHT_SLACK_MS = 1000;

/**
 * Today as `YYYY-MM-DD` in this device's calendar. It changes at midnight by
 * itself, so a screen left open overnight counts the days from the new date
 * (plan §5 #13: nothing that depends on today is stored).
 */
export function useToday(): IsoDate {
  const [today, setToday] = useState(() => localIso(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => {
        setToday(localIso(new Date()));
        arm();
      }, next.getTime() - now.getTime() + MIDNIGHT_SLACK_MS);
    };
    // A sleeping laptop can miss the timer, so look again when the tab comes back.
    const look = () => setToday(localIso(new Date()));
    arm();
    document.addEventListener("visibilitychange", look);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", look);
    };
  }, []);
  return today;
}
