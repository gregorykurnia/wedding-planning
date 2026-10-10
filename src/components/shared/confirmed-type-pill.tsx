"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVendorCategories } from "@/components/vendors/vendor-categories-provider";
import { categoryStyle } from "@/components/vendors/vendor-category-pill";
import type { ConfirmedType } from "@/lib/types";
import { cn } from "@/lib/utils";

const VENUE_STYLE = "bg-primary/15 text-primary border-primary/20";

interface ConfirmedTypePillProps {
  value: ConfirmedType;
  onChange: (value: ConfirmedType) => void;
}

export function ConfirmedTypePill({ value, onChange }: ConfirmedTypePillProps) {
  const { categories } = useVendorCategories();
  const options: ConfirmedType[] = ["Venue", ...categories];

  return (
    <Select value={value} onValueChange={(v) => onChange(v as ConfirmedType)}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-7 w-auto gap-1 rounded-full border px-3 text-xs font-medium shadow-none [&_svg]:size-3",
          value === "Venue" ? VENUE_STYLE : categoryStyle(value),
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((type) => (
          <SelectItem key={type} value={type}>
            {type}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
