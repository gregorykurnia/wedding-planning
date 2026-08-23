"use client";

import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditableNumber } from "@/components/shared/editable-number";
import { VenueNotesCell } from "@/components/venues/venue-notes-cell";
import { VendorCategoryPill } from "@/components/vendors/vendor-category-pill";
import { useVenues, updateVenue } from "@/lib/collections/venues";
import { useVendors, updateVendor } from "@/lib/collections/vendors";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Vendor, VendorCategory, Venue } from "@/lib/types";

type ConfirmedRow =
  | { kind: "venue"; id: string; name: string; type: "Venue"; totalPrice: number; budgetSpent: number; nextTargetDate: string | null; nextAction: string; data: Venue }
  | { kind: "vendor"; id: string; name: string; type: VendorCategory; totalPrice: number; budgetSpent: number; nextTargetDate: string | null; nextAction: string; data: Vendor };

/**
 * A read/write rollup of everything that's actually locked in — the
 * booked venue, contracted/paid vendors — as a single editable list with
 * its own budget tracking (Total Price / Budget Spent / Remaining),
 * independent of the general Budget page.
 */
export default function ConfirmedPage() {
  const { data: venues, loading: venuesLoading } = useVenues();
  const { data: vendors, loading: vendorsLoading } = useVendors();

  const loading = venuesLoading || vendorsLoading;
  const bookedVenue = venues.find((v) => v.status === "Booked");
  const confirmedVendors = vendors.filter(
    (v) => v.contractStatus === "Chosen" || v.contractStatus === "Done",
  );

  const rows: ConfirmedRow[] = [
    ...(bookedVenue
      ? [
          {
            kind: "venue" as const,
            id: bookedVenue.id,
            name: bookedVenue.name,
            type: "Venue" as const,
            totalPrice: bookedVenue.budgetEstimate,
            budgetSpent: bookedVenue.budgetSpent,
            nextTargetDate: bookedVenue.nextTargetDate,
            nextAction: bookedVenue.nextAction,
            data: bookedVenue,
          },
        ]
      : []),
    ...confirmedVendors.map((vendor) => ({
      kind: "vendor" as const,
      id: vendor.id,
      name: vendor.name,
      type: vendor.category,
      totalPrice: vendor.totalPrice,
      budgetSpent: vendor.budgetSpent,
      nextTargetDate: vendor.nextTargetDate,
      nextAction: vendor.nextAction,
      data: vendor,
    })),
  ];

  const totalPrice = rows.reduce((sum, r) => sum + r.totalPrice, 0);
  const totalSpent = rows.reduce((sum, r) => sum + r.budgetSpent, 0);
  const totalRemaining = totalPrice - totalSpent;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Locked in
        </p>
        <h1 className="font-heading text-3xl font-semibold text-foreground sm:text-4xl">
          Confirmed
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything you&apos;ve booked and contracted — no more comparing, just tracking.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/70 bg-gradient-to-br from-blush/50 to-card shadow-sm">
          <CardContent className="flex items-start gap-3 pt-6">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <PiggyBank className="size-4" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total price</p>
              <p className="font-heading text-2xl font-semibold text-foreground">
                {formatIDR(totalPrice)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Real budget spent</p>
            <p className="font-heading text-2xl font-semibold text-foreground">
              {formatIDR(totalSpent)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Remaining budget to spend</p>
            <p
              className={cn(
                "font-heading text-2xl font-semibold",
                totalRemaining < 0 ? "text-destructive" : "text-foreground",
              )}
            >
              {formatIDR(totalRemaining)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Confirmed ({rows.length})
          </h2>
          <Button variant="link" render={<Link href="/vendors" />} className="h-auto px-0">
            Compare more vendors
          </Button>
        </div>

        {rows.length === 0 ? (
          <Card className="border-dashed border-border/70 shadow-none">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <p>Nothing booked or contracted yet.</p>
              <Button variant="link" render={<Link href="/venues" />} className="h-auto px-0">
                Go compare venues
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border-border/70 p-0 shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total price</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budget spent</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remaining budget</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next target date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const remaining = row.totalPrice - row.budgetSpent;
                    return (
                      <TableRow key={`${row.kind}-${row.id}`} className="transition-colors hover:bg-accent/30">
                        <TableCell className="align-top font-medium text-foreground">
                          {row.name}
                        </TableCell>
                        <TableCell className="align-top">
                          {row.kind === "venue" ? (
                            <Badge className="rounded-full bg-primary/15 text-primary hover:bg-primary/15">
                              Venue
                            </Badge>
                          ) : (
                            <VendorCategoryPill
                              value={row.type}
                              onChange={(category) => updateVendor(row.id, { category })}
                            />
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <EditableNumber
                            value={row.totalPrice}
                            onSave={(totalPrice) =>
                              row.kind === "venue"
                                ? updateVenue(row.id, { budgetEstimate: totalPrice })
                                : updateVendor(row.id, { totalPrice })
                            }
                            formatDisplay={formatIDR}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <EditableNumber
                            value={row.budgetSpent}
                            onSave={(budgetSpent) =>
                              row.kind === "venue"
                                ? updateVenue(row.id, { budgetSpent })
                                : updateVendor(row.id, { budgetSpent })
                            }
                            formatDisplay={formatIDR}
                          />
                        </TableCell>
                        <TableCell
                          className={cn(
                            "align-top py-1.5 px-2 text-sm tabular-nums",
                            remaining < 0 && "text-destructive",
                          )}
                        >
                          {formatIDR(remaining)}
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            type="date"
                            value={row.nextTargetDate ?? ""}
                            onChange={(e) =>
                              row.kind === "venue"
                                ? updateVenue(row.id, { nextTargetDate: e.target.value || null })
                                : updateVendor(row.id, { nextTargetDate: e.target.value || null })
                            }
                            className="h-8 w-36 border-none bg-transparent text-xs text-muted-foreground shadow-none"
                          />
                        </TableCell>
                        <TableCell className="align-top min-w-[220px]">
                          <VenueNotesCell
                            value={row.nextAction}
                            onSave={(nextAction) =>
                              row.kind === "venue"
                                ? updateVenue(row.id, { nextAction })
                                : updateVendor(row.id, { nextAction })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
