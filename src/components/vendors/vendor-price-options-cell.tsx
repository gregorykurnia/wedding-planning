"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditableNumber } from "@/components/shared/editable-number";
import { EditableText } from "@/components/shared/editable-text";
import {
  addVendorPriceOption,
  removeVendorPriceOption,
  selectVendorPriceOption,
  updateVendorPriceOption,
} from "@/lib/collections/vendors";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Vendor } from "@/lib/types";

interface VendorPriceOptionsCellProps {
  vendor: Vendor;
}

export function VendorPriceOptionsCell({ vendor }: VendorPriceOptionsCellProps) {
  const options = vendor.priceOptions;

  return (
    <div className="flex flex-col gap-1.5">
      {options.length === 0 && (
        <p className="px-2 py-1.5 text-xs text-muted-foreground italic">No pricing yet</p>
      )}
      {options.map((option) => (
        <div
          key={option.id}
          className={cn(
            "flex items-start gap-1 rounded-md border border-transparent px-1 py-0.5",
            option.selected && "border-primary/40 bg-primary/5",
          )}
        >
          <button
            type="button"
            title={option.selected ? "Selected pricing" : "Use this pricing"}
            onClick={() => selectVendorPriceOption(vendor, option.id)}
            className={cn(
              "mt-2 size-2.5 shrink-0 rounded-full border",
              option.selected
                ? "border-primary bg-primary"
                : "border-muted-foreground/40 bg-transparent",
            )}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <EditableText
              value={option.description}
              onSave={(description) =>
                updateVendorPriceOption(vendor, option.id, { description })
              }
              placeholder="Description (e.g. Silver package)"
              className="px-1 text-xs"
            />
            <EditableNumber
              value={option.price}
              onSave={(price) => updateVendorPriceOption(vendor, option.id, { price })}
              formatDisplay={formatIDR}
              className="px-1 font-medium"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 size-6 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeVendorPriceOption(vendor, option.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-fit gap-1 text-xs"
        onClick={() => addVendorPriceOption(vendor)}
      >
        <Plus className="size-3" />
        Add pricing
      </Button>
    </div>
  );
}
