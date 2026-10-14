/**
 * Every internal link and redirect in the old UI goes through legacyHref().
 * Today the old UI is served from the site root, so it returns the path as is.
 * At the switch-over (Task 7.1) LEGACY_BASE becomes "/old" and the old UI moves
 * with it, without touching each link again.
 */
export const LEGACY_BASE = "";

export function legacyHref(path: string): string {
  if (!path.startsWith("/")) return path;
  if (path === "/") return LEGACY_BASE || "/";
  return `${LEGACY_BASE}${path}`;
}
