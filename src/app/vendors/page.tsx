"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VendorCard } from "@/components/vendors/vendor-card";
import { createVendor, useVendors } from "@/lib/collections/vendors";
import { useBudgetItems } from "@/lib/collections/budget-items";

export default function VendorsPage() {
  const { data: vendors, loading } = useVendors();
  const { data: budgetItems } = useBudgetItems();
  const linkedVendorIds = useMemo(
    () => new Set(budgetItems.map((b) => b.linkedVendorId).filter(Boolean)),
    [budgetItems],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Vendors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Caterers, florists, photographers and everyone else making the day happen.
          </p>
        </div>
        <Button onClick={() => createVendor()} className="gap-1.5 self-start sm:self-auto">
          <Plus className="size-4" />
          Add vendor
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-full rounded-2xl" />
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-center text-muted-foreground">
          <p>No vendors yet.</p>
          <p className="text-sm">Add your first vendor to get started.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {vendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              addedToBudget={linkedVendorIds.has(vendor.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
