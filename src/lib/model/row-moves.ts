/**
 * Moving a row in a list we keep in our own order (guide §4.28; T7). Pure: the
 * screen hands in the ids in order and gets the new order back, or `null` when
 * nothing moves, so it never writes for a move that changes nothing.
 */

export type DropEdge = "above" | "below";

/** Which half of a row the pointer is in: the top half drops above it, the bottom half below. */
export const dropEdge = (offsetY: number, height: number): DropEdge => (offsetY < height / 2 ? "above" : "below");

/** One place up (`-1`) or down (`1`). `null` at either end of the list or for an id that isn't in it. */
export function moveId(ids: readonly string[], id: string, by: -1 | 1): string[] | null {
  const from = ids.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const next = ids.slice();
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

/** `id` lands just above or just below `targetId`. `null` when it would stay where it is. */
export function dropId(ids: readonly string[], id: string, targetId: string, edge: DropEdge): string[] | null {
  if (id === targetId || !ids.includes(id) || !ids.includes(targetId)) return null;
  const rest = ids.filter((x) => x !== id);
  const at = rest.indexOf(targetId) + (edge === "below" ? 1 : 0);
  const next = rest.slice();
  next.splice(at, 0, id);
  return next.every((x, i) => x === ids[i]) ? null : next;
}
