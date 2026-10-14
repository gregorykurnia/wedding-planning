import type { Funder } from "@/lib/model/money";
import { num, str } from "./common";

/**
 * The four funders the old app had built in. Migration 1.11 seeds `funders`
 * with these ids, so records that store the old strings keep pointing at them.
 * Until it has run, the list reads as these four.
 */
export const LEGACY_FUNDERS: readonly Funder[] = [
  { id: "CK", name: "CK" },
  { id: "Gregory", name: "Gregory" },
  { id: "Bella", name: "Bella" },
  { id: "Bella Fam", name: "Bella Fam" },
];

export interface FunderDoc extends Funder {
  order: number;
}

export function funderFromDoc(id: string, data: Record<string, unknown>): FunderDoc {
  return { id, name: str(data.name, id) || id, order: num(data.order) };
}

/**
 * The funder list in its own order. Empty before migration, so the legacy four
 * stand in. A funder id a record still uses but the list doesn't have (for
 * example one removed on another device a moment ago) is not invented here:
 * the model counts those costs under Not assigned.
 */
export function fundersFrom(docs: readonly FunderDoc[]): Funder[] {
  if (docs.length === 0) return [...LEGACY_FUNDERS];
  return [...docs]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(({ id, name }) => ({ id, name }));
}
