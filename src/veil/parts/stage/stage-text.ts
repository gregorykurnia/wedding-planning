import {
  VENDOR_RULED_OUT,
  VENDOR_STAGES,
  VENUE_RULED_OUT,
  VENUE_STAGES,
  indexOf,
  vendorStageLabel,
  venueStageLabel,
  type Choice,
} from "@/lib/model/labels";

/**
 * The stage thread's steps and words (guide §4.21). Vendors run Noted,
 * Inquiring, Considering, Chosen, Done; venues Noted, Contacted, Visited,
 * Booked. Ruled out has no steps and is drawn apart.
 */

export type StageKind = "vendor" | "venue";

const LISTS: Record<StageKind, { steps: readonly Choice[]; ruledOut: string; name: (stage: string) => string }> = {
  vendor: { steps: VENDOR_STAGES, ruledOut: VENDOR_RULED_OUT, name: vendorStageLabel },
  venue: { steps: VENUE_STAGES, ruledOut: VENUE_RULED_OUT, name: venueStageLabel },
};

/** The stages a vendor or venue can be set to, in order, not counting ruled out. */
export const stageSteps = (kind: StageKind): readonly Choice[] => LISTS[kind].steps;

/** The stored value that means ruled out for this kind. */
export const ruledOutStage = (kind: StageKind): string => LISTS[kind].ruledOut;

/** The words for a stored stage, or the stored value itself when the list doesn't know it. */
export const stageLabel = (kind: StageKind, stage: string): string => LISTS[kind].name(stage);

/**
 * What the thread draws. `reached` is the index of the current step, or -1
 * for a stored value the list doesn't know, so no step is filled.
 */
export type ThreadShape =
  | { ruledOut: true; name: string }
  | { ruledOut: false; steps: number; reached: number; name: string };

export function threadShape(kind: StageKind, stage: string): ThreadShape {
  const list = LISTS[kind];
  const name = list.name(stage);
  if (stage === list.ruledOut) return { ruledOut: true, name };
  return { ruledOut: false, steps: list.steps.length, reached: indexOf(list.steps, stage), name };
}
