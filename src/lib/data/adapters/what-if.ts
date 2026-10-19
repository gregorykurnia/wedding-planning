import type { FunderId } from "@/lib/model/bookings";
import type { WhatIfRecord } from "@/lib/model/money";
import { withElementIds } from "@/lib/data/array-ops";
import { millis, num, str, strOrNull } from "./common";

const funderOf = (v: unknown): FunderId => (typeof v === "string" && v ? v : null);

export interface WhatIfDoc extends WhatIfRecord {
  category: string;
  createdAt: number | null;
  updatedBy: string | null;
}

/** What-if items gain a funder; old ones have none (Not assigned). */
export function whatIfFromDoc(id: string, data: Record<string, unknown>): WhatIfDoc {
  return {
    id,
    name: str(data.name),
    category: str(data.type) || "Other",
    totalPrice: num(data.totalPrice),
    funder: funderOf(data.funder),
    subEntries: withElementIds<Record<string, unknown>>(data.subEntries).map((p) => ({
      id: p.id,
      name: str(p.name),
      totalPrice: num(p.totalPrice),
      // Old what-if parts stored `funder: null` always; read it as "the item's".
      ...(typeof p.funder === "string" && p.funder ? { funder: p.funder } : {}),
    })),
    createdAt: millis(data.createdAt),
    updatedBy: strOrNull(data.updatedBy),
  };
}

/**
 * A what-if part stored with `funder: null` reads as the item's funder (old
 * parts always stored null), so null alone can't say "nobody" while the item
 * has a funder. The item's funder first moves down into each part that
 * inherits it, and the item keeps none; then the parts `nobody` picks are
 * stored null and really are Not assigned. What every other part reads as stays.
 */
export function whatIfPartsWithNobody<P extends Record<string, unknown> & { id: string }>(
  item: Record<string, unknown>,
  parts: readonly P[],
  nobody: (part: P) => boolean,
): { subEntries: P[]; funder: null } {
  const inherited = funderOf(item.funder);
  return {
    subEntries: parts.map((p) => {
      if (nobody(p)) return { ...p, funder: null };
      return funderOf(p.funder) === null ? { ...p, funder: inherited } : p;
    }),
    funder: null,
  };
}

/** Who pays a what-if part: its own funder, or the item's when it has none. */
export const whatIfPartFunder = (item: Record<string, unknown>, part: Record<string, unknown>): FunderId =>
  funderOf(part.funder) ?? funderOf(item.funder);
