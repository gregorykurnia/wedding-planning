/**
 * Small readers shared by the adapters: each turns whatever is stored (old
 * shape, new shape, or nothing) into a plain value the model can use. Adapters
 * never write, so the old UI keeps reading the same documents.
 */

export const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);

export const strOrNull = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export const num = (v: unknown): number => numOrNull(v) ?? 0;

/** A Firestore Timestamp (or anything with `toMillis`) as milliseconds. */
export function millis(ts: unknown): number | null {
  if (ts && typeof ts === "object" && "toMillis" in ts) {
    const toMillis = (ts as { toMillis: unknown }).toMillis;
    if (typeof toMillis === "function") return (toMillis as () => number).call(ts);
  }
  return null;
}

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A legacy `{ name, url }` file attached to a record. */
export interface LegacyFile {
  name: string;
  url: string;
}

export function legacyFiles(raw: unknown): LegacyFile[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is LegacyFile => isObject(f) && typeof f.name === "string" && typeof f.url === "string",
  );
}
