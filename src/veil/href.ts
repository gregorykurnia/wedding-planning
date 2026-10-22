import { LEGACY_BASE } from "@/lib/legacy-href";
import type { Section } from "./shell/menu-index";

/**
 * The new UI's address prefix. Its routes are final (plan §4). It served from
 * `/new` while it was built; since Task 7.1 it serves the site root.
 */
export const VEIL_BASE = "";

/**
 * An address inside the new UI. Every link goes through here, so the switch
 * only changed the prefix: `veilHref("/budget")` is `/budget`, and
 * `veilHref("/")` is the overview.
 */
export function veilHref(path: string): string {
  if (path === "/") return VEIL_BASE || "/";
  return `${VEIL_BASE}${path}`;
}

/** The menu sections that own a first path segment; the overview is the root. */
const SECTION_ROOTS: readonly Section[] = ["budget", "vendors", "items", "schedule", "documents", "guests"];

/** A pathname as the new UI's own path: under a `/new` base, `/new/budget` is `/budget` and `/new` is `/`. */
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

/** Whether `path` is the base itself or an address under it. */
const under = (path: string, base: string) =>
  path.startsWith(base) && (path.length === base.length || "/?#".includes(path[base.length]));

/**
 * Where to go after sign-in: `next` only when it is an address inside the new
 * UI, otherwise the overview. At the root that is any path except the old UI's
 * frozen fallback (`/old`). `base` is for tests of a prefixed setup.
 * Backslashes are refused because browsers read `/\evil.com` as `//evil.com`.
 */
export function safeNext(next: string | null, base: string = VEIL_BASE): string {
  const home = base || "/";
  if (!next || next.startsWith("//") || /[\\\s]/.test(next) || /%5c/i.test(next)) return home;
  const inside = base ? under(next, base) : next.startsWith("/") && !(LEGACY_BASE && under(next, LEGACY_BASE));
  return inside ? next : home;
}

/**
 * Replaces the address without a navigation: a query a screen has handled
 * (`?event=`, `?new=1`, …) or the folder Files moved to. Next keeps
 * `useSearchParams` in step with it.
 *
 * The pages whose screens read a query render per request (`connection()` in
 * their `page.tsx`). A prerendered page is cached by the client router without
 * its query, but with the address of the first load: after opening
 * `/documents/files?folder=A`, a link to `/documents/files` went back to folder
 * A, and `router.replace` to the bare path did nothing (Phase 7 review).
 */
export function replaceAddress(href: string): void {
  window.history.replaceState(null, "", href);
}
