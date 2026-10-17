"use client";

import { useWeddingSettings } from "@/lib/collections/settings";
import type { WeddingSettings } from "@/lib/types";
import { useSession } from "./session";
import { set, type WriteOptions } from "./write";

/**
 * Where a read stands (plan §2). `demo` means there is no database to read,
 * so `data` is null there.
 */
export type ReadStatus = "loading" | "ready" | "error" | "offline" | "demo";

export interface Loaded<T> {
  status: ReadStatus;
  /** Null until the first answer arrives, and always null in demonstration mode. */
  data: T | null;
}

/** The couple's settings (`settings/wedding`): names, wedding date, partner's email and venue. */
export function useSettings(): Loaded<WeddingSettings> {
  const { data, loading, error } = useWeddingSettings();
  const { connection } = useSession();
  if (connection === "demo") return { status: "demo", data: null };
  if (error) return { status: "error", data };
  if (connection === "offline") return { status: "offline", data };
  if (loading) return { status: "loading", data: null };
  return { status: "ready", data };
}

/**
 * Sets the wedding date once (guide §5.2, O5), leaving every other field of
 * `settings/wedding` as it is. The document may not exist yet on a new
 * account, so this merges rather than updates.
 */
export function saveWeddingDate(date: string, opts: WriteOptions = {}): Promise<void> {
  return set("settings", "wedding", { weddingDate: date }, { ...opts, merge: true });
}
