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
