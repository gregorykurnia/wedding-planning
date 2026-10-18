"use client";

import { useMemo } from "react";
import type { WhatIfDoc } from "@/lib/data/adapters/what-if";
import type { FunderId, Rupiah } from "@/lib/model/bookings";
import type { Funder } from "@/lib/model/money";
import { logActivity } from "./activity";
import { updateElement } from "./array-ops";
import { mergeStatus } from "./read";
import type { Loaded } from "./settings";
import { removeWithUndo, type Undoable } from "./undo";
import { useBudget } from "./use-budget";
import { useFunders } from "./use-funders";
import { useWhatIf } from "./use-what-if";
import { useCategories } from "./vendors";
import { create, update, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

const WHAT_IF = "hypotheticalItems";

/** Everything the What-if items screen and its sheets read, joined under one status. */
export interface WhatIfPage {
  items: WhatIfDoc[];
  /** The funders in their own order. */
  funders: Funder[];
  /** The category names the sheet offers. */
  categories: string[];
  /** What is booked, the number the what-if items would add to. */
  committed: Rupiah;
}

/** Null data in demonstration mode, where there is no database. */
export function useWhatIfPage(): Loaded<WhatIfPage> {
  const items = useWhatIf();
  const funders = useFunders();
  const budget = useBudget();
  const categories = useCategories();
  const status = mergeStatus(items, funders, budget, categories);
  const data = useMemo<WhatIfPage | null>(() => {
    if (!items.data || !funders.data || !budget.data || !categories.data) return null;
    return {
      items: items.data,
      funders: funders.data.funders,
      categories: categories.data.list,
      committed: budget.data.price,
    };
  }, [items.data, funders.data, budget.data, categories.data]);
  return { status, data: status === "demo" ? null : data };
}

export interface NewWhatIf {
  /** Made when the sheet's form began, so Try again writes the same record. */
  id: string;
  name: string;
  category: string;
  /** The price; `null` when left empty. */
  price: Rupiah | null;
  funder: FunderId;
}

/** Stops an undo of an add from deleting an item that has grown since (parts, files). */
function untouched(data: Record<string, unknown>) {
  const filled = (v: unknown) => Array.isArray(v) && v.length > 0;
  if (filled(data.subEntries) || filled(data.files)) {
    throw new WriteError("changed", "That what-if item has changed since it was added");
  }
}

/**
 * Adds a what-if item (guide §5.10, B8). The fields are the ones the old screens
 * read (`type` for the category, `totalPrice`), plus `funder` for who would pay
 * (B10). Undo removes the item again, unless it has grown meanwhile.
 */
export async function addWhatIf(input: NewWhatIf, opts: WriteOptions = {}): Promise<Undoable> {
  const { id } = input;
  const name = input.name.trim();
  await create(
    WHAT_IF,
    {
      name,
      type: input.category,
      totalPrice: input.price ?? 0,
      funder: input.funder,
      budgetSpent: 0,
      nextTargetDate: null,
      nextAction: "",
      files: [],
      subEntries: [],
    },
    { ...opts, id },
  );
  void logActivity("whatif.added", { name }, { kind: "whatif", id }, opts);
  return {
    undo: async () => {
      await removeWithUndo(WHAT_IF, id, { ...opts, guard: untouched });
    },
  };
}

/** The fields the what-if sheet saves as you go (guide §5.10). An item in parts has no price or funder of its own. */
export interface WhatIfFields {
  name: string;
  category: string;
  price: Rupiah;
  funder: FunderId;
}

const STORED: { [K in keyof WhatIfFields]: (value: WhatIfFields[K]) => Record<string, unknown> } = {
  name: (value) => ({ name: value }),
  category: (value) => ({ type: value }),
  price: (value) => ({ totalPrice: value }),
  funder: (value) => ({ funder: value }),
};

/** Saves one field of the item, by the stored names the old screens read. */
export function setWhatIfField<K extends keyof WhatIfFields>(
  id: string,
  field: K,
  value: WhatIfFields[K],
  opts: WriteOptions = {},
): Promise<void> {
  return update(WHAT_IF, id, STORED[field](value), opts);
}

/** The part's own fields. */
export type WhatIfPartFields = Pick<WhatIfFields, "name" | "price" | "funder">;

const STORED_PART: Record<keyof WhatIfPartFields, string> = { name: "name", price: "totalPrice", funder: "funder" };

/** Saves one field of one part, inside the item as it is now, so another part's change in the meantime stays. */
export async function setWhatIfPartField<K extends keyof WhatIfPartFields>(
  id: string,
  partId: string,
  field: K,
  value: WhatIfPartFields[K],
  opts: WriteOptions = {},
): Promise<void> {
  await updateElement(WHAT_IF, id, "subEntries", partId, { [STORED_PART[field]]: value }, opts);
}
