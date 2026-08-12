"use client";

import { EyeOff, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { VENUE_STATUSES, STATUS_STYLES } from "@/components/venues/venue-status-pill";
import type { VenueStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface VenuesToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeStatuses: VenueStatus[];
  onToggleStatus: (status: VenueStatus) => void;
  budgetMax: string;
  onBudgetMaxChange: (value: string) => void;
  guestMin: string;
  onGuestMinChange: (value: string) => void;
  hideRejected: boolean;
  onHideRejectedChange: (value: boolean) => void;
}

export function VenuesToolbar({
  search,
  onSearchChange,
  activeStatuses,
  onToggleStatus,
  budgetMax,
  onBudgetMaxChange,
  guestMin,
  onGuestMinChange,
  hideRejected,
  onHideRejectedChange,
}: VenuesToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name or notes…"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {VENUE_STATUSES.map((status) => {
          const active = activeStatuses.includes(status);
          return (
            <button
              key={status}
              type="button"
              onClick={() => onToggleStatus(status)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? STATUS_STYLES[status]
                  : "border-border bg-transparent text-muted-foreground hover:bg-accent/60",
              )}
            >
              {status}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onHideRejectedChange(!hideRejected)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            hideRejected
              ? "border-border bg-accent text-foreground"
              : "border-border bg-transparent text-muted-foreground hover:bg-accent/60",
          )}
        >
          <EyeOff className="size-3.5" />
          Hide rejected
        </button>

        <Popover>
          <PopoverTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
            <SlidersHorizontal className="size-3.5" />
            Filters
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="flex flex-col gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="budget-max" className="text-xs">
                  Max budget (IDR)
                </Label>
                <Input
                  id="budget-max"
                  type="number"
                  placeholder="e.g. 200000000"
                  value={budgetMax}
                  onChange={(e) => onBudgetMaxChange(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="guest-min" className="text-xs">
                  Min guest capacity
                </Label>
                <Input
                  id="guest-min"
                  type="number"
                  placeholder="e.g. 150"
                  value={guestMin}
                  onChange={(e) => onGuestMinChange(e.target.value)}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
