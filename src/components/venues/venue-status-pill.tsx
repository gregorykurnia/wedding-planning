"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VenueStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const VENUE_STATUSES: VenueStatus[] = [
  "Considering",
  "Toured",
  "Booked",
  "Rejected",
];

export const STATUS_STYLES: Record<VenueStatus, string> = {
  Considering: "bg-amber-100 text-amber-800 border-amber-200",
  Toured: "bg-sky-100 text-sky-800 border-sky-200",
  Booked: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Rejected: "bg-rose-100 text-rose-800 border-rose-200",
};

interface VenueStatusPillProps {
  value: VenueStatus;
  onChange: (value: VenueStatus) => void;
}

export function VenueStatusPill({ value, onChange }: VenueStatusPillProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as VenueStatus)}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-7 w-auto gap-1 rounded-full border px-3 text-xs font-medium shadow-none [&_svg]:size-3",
          STATUS_STYLES[value],
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {VENUE_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
