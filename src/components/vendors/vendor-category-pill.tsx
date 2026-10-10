"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVendorCategories } from "@/components/vendors/vendor-categories-provider";
import {
  isDefaultVendorCategory,
  type DefaultVendorCategory,
} from "@/lib/collections/vendor-categories";
import type { VendorCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

// Colors for the built-in categories. The Record type makes this a compile
// error if a built-in category is added without a color.
const CATEGORY_STYLES: Record<DefaultVendorCategory, string> = {
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

const CUSTOM_CATEGORY_STYLES = [
  "bg-emerald-100 text-emerald-800 border-emerald-200",
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-yellow-100 text-yellow-800 border-yellow-200",
];

/**
 * Pill colors for any category. Custom categories get one of the palette
 * colors chosen by hashing their name, so each keeps the same color everywhere.
 */
export function categoryStyle(category: VendorCategory): string {
  if (isDefaultVendorCategory(category)) return CATEGORY_STYLES[category];
  let hash = 0;
  for (const char of category) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return CUSTOM_CATEGORY_STYLES[hash % CUSTOM_CATEGORY_STYLES.length];
}

interface VendorCategoryPillProps {
  value: VendorCategory;
  onChange: (value: VendorCategory) => void;
}

export function VendorCategoryPill({ value, onChange }: VendorCategoryPillProps) {
  const { categories } = useVendorCategories();

  return (
    <Select value={value} onValueChange={(v) => onChange(v as VendorCategory)}>
      <SelectTrigger
        size="sm"
        className={cn(
          "h-7 w-auto gap-1 rounded-full border px-3 text-xs font-medium shadow-none [&_svg]:size-3",
          categoryStyle(value),
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {categories.map((category) => (
          <SelectItem key={category} value={category}>
            {category}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
