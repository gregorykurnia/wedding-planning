"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CornerDownRight,
  PiggyBank,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditableDate } from "@/components/shared/editable-date";
import { EditableNumber } from "@/components/shared/editable-number";
import { EditableText } from "@/components/shared/editable-text";
import { FilesCell } from "@/components/shared/files-cell";
import { VenueNotesCell } from "@/components/venues/venue-notes-cell";
import { ConfirmedTypePill } from "@/components/shared/confirmed-type-pill";
import {
  useVenues,
  updateVenue,
  addVenueFile,
  removeVenueFile,
  addVenueSubEntry,
  updateVenueSubEntry,
  removeVenueSubEntry,
  addVenueSubEntryFile,
  removeVenueSubEntryFile,
} from "@/lib/collections/venues";
import {
  useVendors,
  updateVendor,
  createVendor,
  addVendorFile,
  removeVendorFile,
  addVendorSubEntry,
  updateVendorSubEntry,
  removeVendorSubEntry,
  addVendorSubEntryFile,
  removeVendorSubEntryFile,
} from "@/lib/collections/vendors";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConfirmedSubEntry, ConfirmedType, Vendor, VendorFile, Venue } from "@/lib/types";

type ConfirmedRow =
  | { kind: "venue"; id: string; name: string; type: ConfirmedType; totalPrice: number; budgetSpent: number; nextTargetDate: string | null; nextAction: string; files: VendorFile[]; subEntries: ConfirmedSubEntry[]; data: Venue }
  | { kind: "vendor"; id: string; name: string; type: ConfirmedType; totalPrice: number; budgetSpent: number; nextTargetDate: string | null; nextAction: string; files: VendorFile[]; subEntries: ConfirmedSubEntry[]; data: Vendor };

type SortKey = "name" | "type" | "totalPrice" | "budgetSpent" | "remaining" | "nextTargetDate" | "nextAction";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "totalPrice", label: "Total price" },
  { key: "budgetSpent", label: "Budget spent" },
  { key: "remaining", label: "Remaining budget" },
  { key: "nextTargetDate", label: "Next target date" },
  { key: "nextAction", label: "Next actions" },
];

function sortValue(row: ConfirmedRow, key: SortKey): string | number {
  switch (key) {
    case "name":
      return row.name.toLowerCase();
    case "type":
      return row.type.toLowerCase();
    case "totalPrice":
      return row.totalPrice;
    case "budgetSpent":
      return row.budgetSpent;
    case "remaining":
      return row.totalPrice - row.budgetSpent;
    case "nextTargetDate":
      return row.nextTargetDate ?? "9999-99-99";
    case "nextAction":
      return row.nextAction.toLowerCase();
  }
}

/**
 * A read/write rollup of everything that's actually locked in — the
 * booked venue, contracted/paid vendors — as a single editable list with
 * its own budget tracking (Total Price / Budget Spent / Remaining),
 * independent of the general Budget page.
 */
export default function ConfirmedPage() {
  const { data: venues, loading: venuesLoading } = useVenues();
  const { data: vendors, loading: vendorsLoading } = useVendors();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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
            type: bookedVenue.confirmedType,
            totalPrice:
              bookedVenue.subEntries.length > 0
                ? bookedVenue.subEntries.reduce((s, e) => s + e.totalPrice, 0)
                : bookedVenue.budgetEstimate,
            budgetSpent:
              bookedVenue.subEntries.length > 0
                ? bookedVenue.subEntries.reduce((s, e) => s + e.budgetSpent, 0)
                : bookedVenue.budgetSpent,
            nextTargetDate: bookedVenue.nextTargetDate,
            nextAction: bookedVenue.nextAction,
            files: bookedVenue.files,
            subEntries: bookedVenue.subEntries,
            data: bookedVenue,
          },
        ]
      : []),
    ...confirmedVendors.map((vendor) => ({
      kind: "vendor" as const,
      id: vendor.id,
      name: vendor.name,
      type: vendor.confirmedType,
      totalPrice:
        vendor.subEntries.length > 0
          ? vendor.subEntries.reduce((s, e) => s + e.totalPrice, 0)
          : vendor.totalPrice,
      budgetSpent:
        vendor.subEntries.length > 0
          ? vendor.subEntries.reduce((s, e) => s + e.budgetSpent, 0)
          : vendor.budgetSpent,
      nextTargetDate: vendor.nextTargetDate,
      nextAction: vendor.nextAction,
      files: vendor.files,
      subEntries: vendor.subEntries,
      data: vendor,
    })),
  ];

  // Rows with sub-entries already fold those totals into totalPrice/
  // budgetSpent above, so summing rows alone (no separate sub-entry pass)
  // avoids double-counting them in the recap.
  const totalPrice = rows.reduce((sum, r) => sum + r.totalPrice, 0);
  const totalSpent = rows.reduce((sum, r) => sum + r.budgetSpent, 0);
  const totalRemaining = totalPrice - totalSpent;

  const sortedRows = sortKey
    ? [...rows].sort((a, b) => {
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "desc" ? -cmp : cmp;
      })
    : rows;

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
  };

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
            {rows.some((r) => r.subEntries.length > 0) && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                + {rows.reduce((sum, r) => sum + r.subEntries.length, 0)} sub-entries
              </span>
            )}
          </h2>
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => createVendor("Other", "Chosen")}
            >
              <Plus className="size-4" />
              Add vendor
            </Button>
            <Button variant="link" render={<Link href="/vendors" />} className="h-auto px-0">
              Compare more vendors
            </Button>
          </div>
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
                    {SORT_COLUMNS.map((col) => (
                      <TableHead key={col.key} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className="flex items-center gap-1 hover:text-foreground"
                        >
                          {col.label}
                          {sortKey === col.key ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attachments</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.flatMap((row) => {
                    const remaining = row.totalPrice - row.budgetSpent;
                    const mainRow = (
                      <TableRow key={`${row.kind}-${row.id}`} className="transition-colors hover:bg-accent/30">
                        <TableCell className="align-top font-medium text-foreground min-w-[160px]">
                          <EditableText
                            value={row.name}
                            onSave={(name) =>
                              row.kind === "venue"
                                ? updateVenue(row.id, { name })
                                : updateVendor(row.id, { name })
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              row.kind === "venue"
                                ? addVenueSubEntry(row.data)
                                : addVendorSubEntry(row.data)
                            }
                            className="mt-0.5 flex items-center gap-1 px-2 text-xs text-muted-foreground hover:text-primary hover:underline"
                          >
                            <Plus className="size-3" />
                            Add sub-entry
                          </button>
                        </TableCell>
                        <TableCell className="align-top">
                          <ConfirmedTypePill
                            value={row.type}
                            onChange={(confirmedType) =>
                              row.kind === "venue"
                                ? updateVenue(row.id, { confirmedType })
                                : updateVendor(row.id, { confirmedType })
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          {row.subEntries.length > 0 ? (
                            <p
                              title="Sum of sub-entries — edit them individually"
                              className="px-2 py-1.5 text-sm tabular-nums text-muted-foreground"
                            >
                              {formatIDR(row.totalPrice)}
                            </p>
                          ) : (
                            <EditableNumber
                              value={row.totalPrice}
                              onSave={(totalPrice) =>
                                row.kind === "venue"
                                  ? updateVenue(row.id, { budgetEstimate: totalPrice })
                                  : updateVendor(row.id, { totalPrice })
                              }
                              formatDisplay={formatIDR}
                            />
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          {row.subEntries.length > 0 ? (
                            <p
                              title="Sum of sub-entries — edit them individually"
                              className="px-2 py-1.5 text-sm tabular-nums text-muted-foreground"
                            >
                              {formatIDR(row.budgetSpent)}
                            </p>
                          ) : (
                            <EditableNumber
                              value={row.budgetSpent}
                              onSave={(budgetSpent) =>
                                row.kind === "venue"
                                  ? updateVenue(row.id, { budgetSpent })
                                  : updateVendor(row.id, { budgetSpent })
                              }
                              formatDisplay={formatIDR}
                            />
                          )}
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
                          <EditableDate
                            value={row.nextTargetDate}
                            onSave={(nextTargetDate) =>
                              row.kind === "venue"
                                ? updateVenue(row.id, { nextTargetDate })
                                : updateVendor(row.id, { nextTargetDate })
                            }
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
                        <TableCell className="align-top">
                          <FilesCell
                            files={row.files}
                            onAdd={(file) =>
                              row.kind === "venue"
                                ? addVenueFile(row.data, file)
                                : addVendorFile(row.data, file)
                            }
                            onRemove={(url) =>
                              row.kind === "venue"
                                ? removeVenueFile(row.data, url)
                                : removeVendorFile(row.data, url)
                            }
                          />
                        </TableCell>
                        <TableCell className="align-top" />
                      </TableRow>
                    );

                    const subRows = row.subEntries.map((entry) => {
                      const subRemaining = entry.totalPrice - entry.budgetSpent;
                      return (
                        <TableRow
                          key={`${row.kind}-${row.id}-sub-${entry.id}`}
                          className="bg-muted/20 transition-colors hover:bg-accent/20"
                        >
                          <TableCell className="align-top min-w-[160px] pl-8">
                            <div className="flex items-start gap-1.5">
                              <CornerDownRight className="mt-1.5 size-3.5 shrink-0 text-muted-foreground" />
                              <EditableText
                                value={entry.name}
                                onSave={(name) =>
                                  row.kind === "venue"
                                    ? updateVenueSubEntry(row.data, entry.id, { name })
                                    : updateVendorSubEntry(row.data, entry.id, { name })
                                }
                              />
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge
                              variant="secondary"
                              className="rounded-full text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                            >
                              Sub-entry
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <EditableNumber
                              value={entry.totalPrice}
                              onSave={(totalPrice) =>
                                row.kind === "venue"
                                  ? updateVenueSubEntry(row.data, entry.id, { totalPrice })
                                  : updateVendorSubEntry(row.data, entry.id, { totalPrice })
                              }
                              formatDisplay={formatIDR}
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <EditableNumber
                              value={entry.budgetSpent}
                              onSave={(budgetSpent) =>
                                row.kind === "venue"
                                  ? updateVenueSubEntry(row.data, entry.id, { budgetSpent })
                                  : updateVendorSubEntry(row.data, entry.id, { budgetSpent })
                              }
                              formatDisplay={formatIDR}
                            />
                          </TableCell>
                          <TableCell
                            className={cn(
                              "align-top py-1.5 px-2 text-sm tabular-nums",
                              subRemaining < 0 && "text-destructive",
                            )}
                          >
                            {formatIDR(subRemaining)}
                          </TableCell>
                          <TableCell className="align-top">
                            <EditableDate
                              value={entry.nextTargetDate}
                              onSave={(nextTargetDate) =>
                                row.kind === "venue"
                                  ? updateVenueSubEntry(row.data, entry.id, { nextTargetDate })
                                  : updateVendorSubEntry(row.data, entry.id, { nextTargetDate })
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top min-w-[220px]">
                            <VenueNotesCell
                              value={entry.nextAction}
                              onSave={(nextAction) =>
                                row.kind === "venue"
                                  ? updateVenueSubEntry(row.data, entry.id, { nextAction })
                                  : updateVendorSubEntry(row.data, entry.id, { nextAction })
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <FilesCell
                              files={entry.files}
                              onAdd={(file) =>
                                row.kind === "venue"
                                  ? addVenueSubEntryFile(row.data, entry.id, file)
                                  : addVendorSubEntryFile(row.data, entry.id, file)
                              }
                              onRemove={(url) =>
                                row.kind === "venue"
                                  ? removeVenueSubEntryFile(row.data, entry.id, url)
                                  : removeVendorSubEntryFile(row.data, entry.id, url)
                              }
                            />
                          </TableCell>
                          <TableCell className="align-top">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                row.kind === "venue"
                                  ? removeVenueSubEntry(row.data, entry.id)
                                  : removeVendorSubEntry(row.data, entry.id)
                              }
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    });

                    return [mainRow, ...subRows];
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
