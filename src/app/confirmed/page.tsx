"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { BadgeCheck, ImageIcon, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useVenues } from "@/lib/collections/venues";
import { useVendors } from "@/lib/collections/vendors";
import { useBudgetItems } from "@/lib/collections/budget-items";
import { formatIDR } from "@/lib/format";

/**
 * A read-mostly rollup of everything that's actually locked in — the
 * booked venue, contracted/paid vendors, and the budget lines tied to
 * them. This is the "we're past comparing options" view, as distinct
 * from the Venues/Vendors pages which stay full comparison workspaces.
 */
export default function ConfirmedPage() {
  const { data: venues, loading: venuesLoading } = useVenues();
  const { data: vendors, loading: vendorsLoading } = useVendors();
  const { data: budgetItems, loading: budgetLoading } = useBudgetItems();

  const loading = venuesLoading || vendorsLoading || budgetLoading;
  const bookedVenue = venues.find((v) => v.status === "Booked");
  const confirmedVendors = vendors.filter(
    (v) => v.contractStatus === "Chosen" || v.contractStatus === "Done",
  );
  const linkedBudgetItems = budgetItems.filter(
    (b) => b.linkedVenueId || b.linkedVendorId,
  );
  const confirmedSpend = linkedBudgetItems.reduce((sum, b) => sum + b.actualAmount, 0);
  const confirmedEstimate = linkedBudgetItems.reduce((sum, b) => sum + b.estimatedAmount, 0);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
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

      <Card className="border-border/70 bg-gradient-to-br from-blush/50 to-card shadow-sm">
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <PiggyBank className="size-5" />
          </div>
          <CardTitle className="font-heading text-base font-semibold">
            Confirmed spend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-heading text-2xl font-semibold text-foreground">
            {formatIDR(confirmedSpend)}{" "}
            <span className="text-base font-normal text-muted-foreground">spent so far</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            of {formatIDR(confirmedEstimate)} estimated across {linkedBudgetItems.length}{" "}
            confirmed line{linkedBudgetItems.length === 1 ? "" : "s"}
          </p>
          <Button variant="link" render={<Link href="/budget" />} className="mt-1 h-auto px-0">
            View full budget
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">Venue</h2>
        {bookedVenue ? (
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="size-20 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted">
                {bookedVenue.coverImage ? (
                  <img
                    src={bookedVenue.coverImage}
                    alt={bookedVenue.name}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="size-6" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-heading text-lg font-semibold text-foreground">
                    {bookedVenue.name}
                  </p>
                  <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    <BadgeCheck className="size-3.5" />
                    Booked
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Up to {bookedVenue.guestMax} guests · {formatIDR(bookedVenue.budgetEstimate)}{" "}
                  estimated
                </p>
                {bookedVenue.notes && (
                  <p className="mt-1 text-sm text-muted-foreground">{bookedVenue.notes}</p>
                )}
              </div>
              <Button variant="outline" size="sm" render={<Link href="/venues" />}>
                View in Venues
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="border-dashed border-border/70 shadow-none">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <p>No venue booked yet.</p>
              <Button variant="link" render={<Link href="/venues" />} className="h-auto px-0">
                Go compare venues
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">
          Vendors ({confirmedVendors.length})
        </h2>
        {confirmedVendors.length === 0 ? (
          <Card className="border-dashed border-border/70 shadow-none">
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <p>No vendors contracted yet.</p>
              <Button variant="link" render={<Link href="/vendors" />} className="h-auto px-0">
                Go compare vendors
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {confirmedVendors.map((vendor) => (
              <Card key={vendor.id} className="border-border/70 shadow-sm">
                <CardContent className="flex flex-col gap-1.5 pt-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading text-base font-semibold text-foreground">
                      {vendor.name}
                    </p>
                    <Badge
                      className={
                        vendor.contractStatus === "Done"
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                          : "bg-sky-100 text-sky-800 hover:bg-sky-100"
                      }
                    >
                      {vendor.contractStatus}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{vendor.category}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
