import { devFaults } from "./dev-faults";
import type { Connection } from "./session";
import type { Loaded, ReadStatus } from "./settings";

/**
 * The status of a read built from one or more collection listeners (plan §2.7),
 * worked out as `useSettings` does: demonstration mode has no data at all, an
 * error or being offline keep whatever has arrived, and loading has none yet
 * (offline with a read still waiting has none either, so the screen says so).
 */
export function readOf<T>(
  connection: Connection,
  sources: readonly { loading: boolean; error: string | null; arrived?: boolean }[],
  data: T,
): Loaded<T> {
  if (connection === "demo") return { status: "demo", data: null };
  // Dev only (`?fault=load`): the read failed before any data arrived.
  if (devFaults().load) return { status: "error", data: null };
  // A read that failed before its first answer has nothing to show, not an empty list (guide §6.5).
  if (sources.some((s) => s.error)) {
    return { status: "error", data: sources.some((s) => s.error && s.arrived === false) ? null : data };
  }
  if (connection === "offline") return { status: "offline", data: sources.some((s) => s.loading) ? null : data };
  if (sources.some((s) => s.loading)) return { status: "loading", data: null };
  return { status: "ready", data };
}

/**
 * The status of several reads taken together: the worst one wins (demo, then
 * error, offline, loading). The caller joins the data, in a `useMemo` over the
 * reads' own data so the joined result stays the same object between renders.
 */
export function mergeStatus(...reads: readonly Loaded<unknown>[]): ReadStatus {
  const worst = (["demo", "error", "offline", "loading"] as const).find((s) => reads.some((r) => r.status === s));
  return worst ?? "ready";
}
