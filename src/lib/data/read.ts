import type { Connection } from "./session";
import type { Loaded } from "./settings";

/** One listener's state, as the generic collection hook reports it. */
export interface ReadSource {
  loading: boolean;
  error: string | null;
}

/**
 * Folds several listeners into one read, the way `useSettings` does for one:
 * demonstration mode has no data, a failed listener is an error, an offline
 * device shows what it has cached (or `offline` when nothing has arrived), and
 * the screen is ready once every listener has answered once.
 */
export function composeRead<T>(connection: Connection, sources: readonly ReadSource[], data: T): Loaded<T> {
  if (connection === "demo") return { status: "demo", data: null };
  const loading = sources.some((s) => s.loading);
  if (sources.some((s) => s.error)) return { status: "error", data: loading ? null : data };
  if (connection === "offline") return { status: "offline", data: loading ? null : data };
  if (loading) return { status: "loading", data: null };
  return { status: "ready", data };
}

/**
 * Two reads as one, for a screen that needs both: the more serious status wins
 * (demonstration, error, offline, loading), and there is data only once both
 * have it.
 */
export function mergeReads<A, B>(a: Loaded<A>, b: Loaded<B>): Loaded<[A, B]> {
  const statuses = [a.status, b.status];
  const status = (["demo", "error", "offline", "loading"] as const).find((s) => statuses.includes(s)) ?? "ready";
  return { status, data: a.data !== null && b.data !== null ? [a.data, b.data] : null };
}
