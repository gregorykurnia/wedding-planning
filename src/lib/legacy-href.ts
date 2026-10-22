/**
 * Every internal link and redirect in the old UI goes through legacyHref().
 * Since the switch-over (Task 7.1) the old UI is the frozen fallback under
 * `/old`, so `legacyHref("/confirmed")` is `/old/confirmed`.
 */
export const LEGACY_BASE = "/old";

export function legacyHref(path: string): string {
  if (!path.startsWith("/")) return path;
  if (path === "/") return LEGACY_BASE || "/";
  return `${LEGACY_BASE}${path}`;
}
