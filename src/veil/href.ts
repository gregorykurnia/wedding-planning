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
