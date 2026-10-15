"use client";

import { useWeddingSettings } from "@/lib/collections/settings";
import type { WeddingSettings } from "@/lib/types";
import { useSession } from "./session";

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
