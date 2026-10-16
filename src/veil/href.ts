import type { Section } from "./shell/menu-index";

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

/** The menu sections that own a first path segment; the overview is the root. */
const SECTION_ROOTS: readonly Section[] = ["budget", "vendors", "items", "schedule", "documents", "guests"];

/** A pathname as the new UI's own path: `/new/budget` is `/budget`, `/new` is `/`. */
function localPath(pathname: string, base: string): string {
  if (!base) return pathname;
  if (pathname === base) return "/";
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}

/**
 * The menu section a screen belongs to, worked out from its address, so the
 * top bar the shell draws marks it without each screen saying so. Screens
 * outside the seven sections (settings, a missing page) have none.
 */
export function sectionOf(pathname: string, base: string = VEIL_BASE): Section | undefined {
  const path = localPath(pathname, base);
  if (path === "/") return "overview";
  const first = path.split("/")[1] as Section;
  return SECTION_ROOTS.includes(first) ? first : undefined;
}

/**
 * Whether the shell draws the top bar (and the demonstration banner) above the
 * screen. Sign-in has neither, and the dev-only gallery draws its own.
 */
export function showsTopBar(pathname: string, base: string = VEIL_BASE): boolean {
  const first = localPath(pathname, base).split("/")[1];
  return first !== "sign-in" && first !== "gallery";
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
