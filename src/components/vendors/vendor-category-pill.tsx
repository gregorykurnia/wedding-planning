"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VENDOR_CATEGORIES } from "@/components/vendors/vendor-category-tabs";
import type { VendorCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export const CATEGORY_STYLES: Record<VendorCategory, string> = {
  Decoration: "bg-lime-100 text-lime-800 border-lime-200",
  Food: "bg-orange-100 text-orange-800 border-orange-200",
  "Groom Suit": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Bride Dress": "bg-pink-100 text-pink-800 border-pink-200",
  Invites: "bg-amber-100 text-amber-800 border-amber-200",
  "Makeup Artist": "bg-rose-100 text-rose-800 border-rose-200",
  "Music/DJ": "bg-cyan-100 text-cyan-800 border-cyan-200",
  "Photos and Videos": "bg-violet-100 text-violet-800 border-violet-200",
  Transportation: "bg-teal-100 text-teal-800 border-teal-200",
  "Wedding Cake": "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  "Wedding Organizer": "bg-sky-100 text-sky-800 border-sky-200",
  Other: "bg-muted text-muted-foreground border-border",
};

interface VendorCategoryPillProps {
  value: VendorCategory;
  onChange: (value: VendorCategory) => void;
}

export function VendorCategoryPill({ value, onChange }: VendorCategoryPillProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as VendorCategory)}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-7 w-auto gap-1 rounded-full border px-3 text-xs font-medium shadow-none [&_svg]:size-3",
          CATEGORY_STYLES[value],
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {VENDOR_CATEGORIES.map((category) => (
          <SelectItem key={category} value={category}>
            {category}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
