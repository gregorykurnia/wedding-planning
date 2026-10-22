/**
 * Counts the tries on each field, so a write that lands late knows a newer one
 * on the same field is still holding what was typed (Phase 5 review S19). Only
 * the newest try lets the field go; an older one landing changes nothing.
 * Pure, so the screens and the tests share it.
 */
export class Tries {
  private latest = new Map<string, number>();
  private count = 0;

  /** A new try on `key`; the number it returns is what `settle` takes. */
  start(key: string): number {
    const n = ++this.count;
    this.latest.set(key, n);
    return n;
  }

  /** Whether `n` is still the newest try on `key`; a failure of an older one isn't shown. */
  newest(key: string, n: number): boolean {
    return this.latest.get(key) === n;
  }

  /** Try `n` on `key` landed: true when it was the newest, and the key is let go. */
  settle(key: string, n: number): boolean {
    if (this.latest.get(key) !== n) return false;
    this.latest.delete(key);
    return true;
  }
}
