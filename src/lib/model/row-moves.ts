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

/**
 * Inserting between two rows halves the gap each time, so after enough inserts
 * the positions run out of precision. Below this gap the list is renumbered
 * first (inventory-notes §5 #27).
 */
export const MIN_SORT_GAP = 1e-6;

/**
 * `count` positions for rows that go between two neighbours in the list we
 * keep in our own order: `before` is the row above (`null` at the top) and
 * `after` the row below (`null` at the end). `null` when there is no room left
 * between them, so the list has to be renumbered first.
 */
export function positionsBetween(before: number | null, after: number | null, count = 1): number[] | null {
  const at = (from: number, step: number) => Array.from({ length: count }, (_, i) => from + step * i);
  if (before === null && after === null) return at(0, 1);
  if (before === null) return at(after! - count, 1);
  if (after === null) return at(before + 1, 1);
  const spacing = (after - before) / (count + 1);
  if (!Number.isFinite(spacing) || spacing < MIN_SORT_GAP) return null;
  return at(before + spacing, spacing);
}

/** The ids on either side of `id` in a new order: the row above it and the row below it, `null` at an end. */
export function neighboursOf(ids: readonly string[], id: string): { above: string | null; below: string | null } {
  const at = ids.indexOf(id);
  return { above: at > 0 ? ids[at - 1] : null, below: at >= 0 && at < ids.length - 1 ? ids[at + 1] : null };
}

/**
 * A move made on a page of the list (the first rows shown) as the whole list:
 * the rows past the page follow it, so a row dropped last on the page lands
 * above the first hidden one rather than tying with it (Phase 4 review S21).
 */
export const withRest = (pageIds: readonly string[], allIds: readonly string[]): string[] => {
  const onPage = new Set(pageIds);
  return [...pageIds, ...allIds.filter((id) => !onPage.has(id))];
};

/** A pending order with rows just added below `afterId`, or at the end when it is null or not in it (Phase 6 review S8). */
export function withAdded(ids: readonly string[], added: readonly string[], afterId: string | null): string[] {
  const fresh = new Set(added);
  const rest = ids.filter((id) => !fresh.has(id));
  const at = afterId === null ? -1 : rest.indexOf(afterId);
  return at < 0 ? [...rest, ...added] : [...rest.slice(0, at + 1), ...added, ...rest.slice(at + 1)];
}

/** `rows` in the order `ids` gives; any row it doesn't name keeps its place after them. */
export function inOrder<T extends { id: string }>(rows: readonly T[], ids: readonly string[]): T[] {
  const at = new Map(ids.map((id, i) => [id, i]));
  return rows
    .map((row, index) => ({ row, rank: at.get(row.id) ?? ids.length + index }))
    .sort((a, z) => a.rank - z.rank)
    .map((x) => x.row);
}
