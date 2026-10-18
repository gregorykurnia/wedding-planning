import { ChipGroup } from "@/veil/parts/chips/chip";
import { ruledOutStage, stageLabel, stageSteps, type StageKind } from "./stage-text";

export interface StageChipsProps {
  kind: StageKind;
  /** The stored stage that is chosen now. */
  stage: string;
  /** Names the group for screen readers. The default reads "Stage". */
  label?: string;
  /** Demonstration mode: every chip is inert. */
  disabled?: boolean;
  /** For a screen that places the row (a detail screen centres it under the title). */
  className?: string;
  /**
   * Called with the stored value of the chip picked. Choosing Chosen (vendors)
   * or Booked (venues) creates a booking: the screen does that write, not this part.
   */
  onChange: (stage: string) => void;
}

/**
 * Guide §4.21 and §4.10: on a detail screen the stage is set with a chip row,
 * every stage plus "Ruled out". It's a single choice, so it's a radio group.
 */
export function StageChips({ kind, stage, label = "Stage", disabled = false, className, onChange }: StageChipsProps) {
  const options = [
    ...stageSteps(kind),
    { value: ruledOutStage(kind), label: stageLabel(kind, ruledOutStage(kind)) },
  ];
  return (
    <ChipGroup label={label} options={options} value={stage} onChange={onChange} disabled={disabled} className={className} />
  );
}
