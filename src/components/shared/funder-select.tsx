"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Funder } from "@/lib/types";

export const FUNDER_OPTIONS: Funder[] = ["CK", "Gregory", "Bella"];

const UNASSIGNED_VALUE = "__unassigned__";

interface FunderSelectProps {
  value: Funder | null;
  onChange: (value: Funder | null) => void;
}

export function FunderSelect({ value, onChange }: FunderSelectProps) {
  return (
    <Select
      value={value ?? UNASSIGNED_VALUE}
      onValueChange={(nextValue) =>
        onChange(nextValue === UNASSIGNED_VALUE ? null : (nextValue as Funder))
      }
    >
      <SelectTrigger
        size="sm"
        className="h-7 w-[7.5rem] rounded-full border-border/70 px-3 text-xs font-medium shadow-none"
      >
        <SelectValue>{value ?? "Unassigned"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
        {FUNDER_OPTIONS.map((funder) => (
          <SelectItem key={funder} value={funder}>
            {funder}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
