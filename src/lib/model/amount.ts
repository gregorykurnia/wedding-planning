import { parseNumber } from "./formulas";

/** Past this a figure stops fitting anywhere in the design; 15 digits is also far below 2^53. */
const LIMIT = 1e15;

/**
 * Reads what was typed in a money field (guide §4.9): "Rp 12.500.000",
 * "12500000" and "12,5" all work. Returns null for a blank field (no amount),
 * and undefined when the text isn't an amount a booking can hold: words, a
 * negative number or an absurdly big one. Amounts are whole rupiah.
 */
export function readAmount(text: string): number | null | undefined {
  const parsed = parseNumber(text);
  if (parsed.blank) return null;
  if (parsed.text || parsed.value < 0 || parsed.value >= LIMIT) return undefined;
  return Math.round(parsed.value);
}
