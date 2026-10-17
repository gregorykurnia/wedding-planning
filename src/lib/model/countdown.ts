import type { IsoDate } from "./bookings";
import { daysUntil } from "./dates";

/**
 * Where the wedding stands for the closing line (guide §5.4, N7): counting
 * down, the eve, the day itself, or after it. After the day the count ends
 * (decision 26), so there is no number to show.
 */
export type Countdown =
  | { phase: "before"; days: number }
  | { phase: "eve" }
  | { phase: "day" }
  | { phase: "after" };

/** `null` until the wedding date is set. */
export function countdown(wedding: IsoDate | null, today: IsoDate): Countdown | null {
  if (!wedding) return null;
  const n = daysUntil(wedding, today);
  if (n < 0) return { phase: "after" };
  if (n === 0) return { phase: "day" };
  if (n === 1) return { phase: "eve" };
  return { phase: "before", days: n };
}
