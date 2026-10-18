"use client";

import { whatIfFromDoc, type WhatIfDoc } from "@/lib/data/adapters/what-if";
import { useCollection } from "@/lib/use-collection";
import { readOf } from "./read";
import { useSession } from "./session";
import type { Loaded } from "./settings";

/**
 * Every what-if item, read live (guide §5.10). No order is asked of Firestore,
 * since an ordered query leaves out documents that lack the field.
 */
export function useWhatIf(): Loaded<WhatIfDoc[]> {
  const items = useCollection<WhatIfDoc>("hypotheticalItems", whatIfFromDoc, []);
  const { connection } = useSession();
  return readOf(connection, [items], items.data);
}
