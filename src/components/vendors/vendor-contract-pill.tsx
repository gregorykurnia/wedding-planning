"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContractStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CONTRACT_STATUSES: ContractStatus[] = [
  "Inquiring",
  "Consideration",
  "Chosen",
  "Done",
  "Rejected",
];

export const CONTRACT_STYLES: Record<ContractStatus, string> = {
  Inquiring: "bg-muted text-muted-foreground border-border",
  Consideration: "bg-amber-100 text-amber-800 border-amber-200",
  Chosen: "bg-sky-100 text-sky-800 border-sky-200",
  Done: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Rejected: "bg-pink-100 text-pink-800 border-pink-200",
};

interface VendorContractPillProps {
  value: ContractStatus;
  onChange: (value: ContractStatus) => void;
}

export function VendorContractPill({ value, onChange }: VendorContractPillProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ContractStatus)}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-7 w-auto gap-1 rounded-full border px-3 text-xs font-medium shadow-none [&_svg]:size-3",
          CONTRACT_STYLES[value],
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONTRACT_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
