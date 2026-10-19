import { rp } from "./format";
import { parseNumber } from "./formulas";

/** Past this a figure stops fitting anywhere in the design; 15 digits is also far below 2^53. */
const LIMIT = 1e15;

/** "Rp 1.000.000,-", the usual way to write a price: the ",-" says there are no cents. */
const withoutDash = (text: string) => String(text ?? "").trim().replace(/,\s*-$/, "");

/**
 * Reads what was typed in a money field (guide §4.9): "Rp 12.500.000",
 * "12500000", "Rp 1.000.000,-" and "1.000.000,00" all work. Returns null for a
 * blank field (no amount), and undefined when the text isn't an amount a
 * booking can hold: words, a negative number, cents (rupiah are whole, so
 * "12,5" isn't rounded to 13) or an absurdly big one.
 */
export function readAmount(text: string): number | null | undefined {
  const parsed = parseNumber(withoutDash(text));
  if (parsed.blank) return null;
  if (parsed.text || parsed.value < 0 || parsed.value >= LIMIT || !Number.isInteger(parsed.value)) return undefined;
  // "-0" is 0, not minus zero.
  return parsed.value + 0;
}

export type AmountProblem = "words" | "minus" | "decimals" | "big";

/**
 * Why a money field can't use what was typed (N16, guide §4.9, §6.9): words, a
 * minus, decimals or more than 15 digits. `null` for a blank field or a usable
 * amount. Rupiah has no decimals, so "12,5" is refused, as `readAmount` does.
 */
export function amountProblem(text: string): AmountProblem | null {
  const typed = withoutDash(text);
  if (/^[-−–]/.test(typed)) return "minus";
  const parsed = parseNumber(typed);
  if (parsed.blank) return null;
  if (parsed.text) return "words";
  if (parsed.value < 0) return "minus";
  if (!Number.isInteger(parsed.value)) return "decimals";
  if (parsed.value >= LIMIT) return "big";
  return null;
}

const SHOWN = 40;

/**
 * What the field says when it puts the old amount back (guide §4.9): it quotes
 * what was typed and says what the amount stays as, or "Nothing was changed."
 * when there was no amount before.
 */
export function amountMessage(problem: AmountProblem, typed: string, before: number | null): string {
  const trimmed = typed.trim();
  const shown = trimmed.length > SHOWN ? `${trimmed.slice(0, SHOWN)}…` : trimmed;
  const stays = before === null ? "Nothing was changed." : `It stays ${rp(before)}.`;
  switch (problem) {
    case "words":
      return `“${shown}” isn’t an amount. Use digits, like 12500000. ${stays}`;
    case "minus":
      return `An amount can’t be below zero, so “${shown}” can’t be used. ${stays}`;
    case "decimals":
      return `Rupiah amounts have no decimals, so “${shown}” can’t be used. ${stays}`;
    case "big":
      return `That’s more than an amount can hold here: up to Rp 999.999.999.999.999. ${stays}`;
  }
}
