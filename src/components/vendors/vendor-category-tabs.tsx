"use client";

import type { VendorCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export const VENDOR_CATEGORIES: VendorCategory[] = [
  "Decoration",
  "Food",
  "Invites",
  "Makeup Artist",
  "Music/DJ",
  "Photos and Videos",
  "Transportation",
  "Wedding Cake",
  "Wedding Organizer",
  "Other",
];

interface VendorCategoryTabsProps {
  active: VendorCategory | "All";
  onChange: (category: VendorCategory | "All") => void;
  counts: Record<string, number>;
}

export function VendorCategoryTabs({ active, onChange, counts }: VendorCategoryTabsProps) {
  const tabs: (VendorCategory | "All")[] = ["All", ...VENDOR_CATEGORIES];

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
      {tabs.map((tab) => {
        const isActive = tab === active;
        const count = tab === "All" ? counts.All ?? 0 : counts[tab] ?? 0;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {tab}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                isActive ? "bg-primary-foreground/20" : "bg-muted",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
