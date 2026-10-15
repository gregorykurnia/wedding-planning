/**
 * The new UI's address prefix. Its routes are final (plan §4), and until Task
 * 7.1 moves the new UI to the root, every one of them sits under `/new`.
 */
export const VEIL_BASE = "/new";

/**
 * An address inside the new UI. Every link goes through here, so Task 7.1 only
 * changes the prefix: `veilHref("/budget")` is `/new/budget`, and
 * `veilHref("/")` is the overview.
 */
export function veilHref(path: string): string {
  if (path === "/") return VEIL_BASE || "/";
  return `${VEIL_BASE}${path}`;
}

/**
 * Where to go after sign-in: `next` only when it is an address inside the new
 * UI, otherwise the overview. `base` is for tests of the root setup (7.1).
 * Backslashes are refused because browsers read `/\evil.com` as `//evil.com`.
 */
export function safeNext(next: string | null, base: string = VEIL_BASE): string {
  const home = base || "/";
  if (!next || next.startsWith("//") || /[\\\s]/.test(next) || /%5c/i.test(next)) return home;
  const inside = base ? next === base || next.startsWith(`${base}/`) || next.startsWith(`${base}?`) : next.startsWith("/");
  return inside ? next : home;
}
