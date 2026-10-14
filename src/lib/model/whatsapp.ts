/**
 * WhatsApp links (F7, inventory-notes §5 #31).
 *
 * Indonesian numbers written with a leading 0 become +62; numbers with a plus
 * or country code are kept. Anything after "ext" or "x" is an extension and
 * isn't dialled.
 */

/** The `wa.me` address for a phone number, or `null` when there isn't a usable number. */
export function waHref(phone: string | null | undefined): string | null {
  let digits = String(phone ?? "")
    .replace(/\b(ext\.?|x)\s*\d+\s*$/i, "")
    .replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  digits = digits.replace(/\D/g, "");
  return digits.length >= 7 ? "https://wa.me/" + digits : null;
}
