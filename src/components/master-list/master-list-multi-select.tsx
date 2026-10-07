"use client";

import { useState } from "react";
import { ChevronDown, ListFilter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface MasterListMultiSelectProps {
  label: string;
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => Promise<void> | void;
  placeholder?: string;
  filterStyle?: boolean;
  className?: string;
}

export function MasterListMultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = `Select ${label.toLowerCase()}`,
  filterStyle = false,
  className,
}: MasterListMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<string[] | null>(null);
  const selected = options.filter((option) => (pendingValue ?? value).includes(option));

  const toggle = (option: string, checked: boolean) => {
    const next = checked
      ? [...selected, option]
      : selected.filter((selectedOption) => selectedOption !== option);
    setPendingValue(next);
    void Promise.resolve(onChange(next)).catch(() => undefined);
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setPendingValue(nextOpen ? value : null);
      }}
    >
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex min-h-8 min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-sm transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
              filterStyle && selected.length > 0 && "border-primary/40 bg-primary/5 text-foreground",
              className,
            )}
            aria-label={`${label} filter`}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {filterStyle && <ListFilter className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className={cn("min-w-0 truncate", selected.length === 0 && "text-muted-foreground")} title={selected.join(", ")}>
            {selected.length > 0 ? selected.join(", ") : placeholder}
          </span>
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="px-1.5 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selected.includes(option)}
            onCheckedChange={(checked) => toggle(option, checked === true)}
          >
            {option}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={selected.length === 0}
          onClick={() => {
            setPendingValue([]);
            void Promise.resolve(onChange([])).catch(() => undefined);
          }}
        >
          Clear selection
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
