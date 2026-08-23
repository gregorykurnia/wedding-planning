"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, PiggyBank, Plus, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CloudinaryUploadButton } from "@/components/cloudinary-upload-button";
import { EditableText } from "@/components/shared/editable-text";
import { EditableNumber } from "@/components/shared/editable-number";
import { VenueGalleryDialog } from "@/components/venues/venue-gallery-dialog";
import { VenueStatusPill } from "@/components/venues/venue-status-pill";
import { VenueNotesCell } from "@/components/venues/venue-notes-cell";
import { VenuesToolbar } from "@/components/venues/venues-toolbar";
import {
  addVenueImage,
  createVenue,
  deleteVenue,
  updateVenue,
  useVenues,
} from "@/lib/collections/venues";
import { useWorkspace } from "@/lib/workspace-context";
import { createBudgetItemFromVenue, useBudgetItems } from "@/lib/collections/budget-items";
import { formatIDR } from "@/lib/format";
import type { Venue, VenueStatus } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function VenuesTable() {
  const { workspace } = useWorkspace();
  const { data: venues, loading } = useVenues(workspace?.id ?? null);
  const { data: budgetItems } = useBudgetItems(workspace?.id ?? null);
  const linkedVenueIds = useMemo(
    () => new Set(budgetItems.map((b) => b.linkedVenueId).filter(Boolean)),
    [budgetItems],
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");
  const [activeStatuses, setActiveStatuses] = useState<VenueStatus[]>([]);
  const [budgetMax, setBudgetMax] = useState("");
  const [guestMin, setGuestMin] = useState("");
  const [hideRejected, setHideRejected] = useState(false);

  const toggleStatus = (status: VenueStatus) => {
    setActiveStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    );
  };

  const filtered = useMemo(() => {
    return venues.filter((v) => {
      if (hideRejected && v.status === "Rejected") return false;
      if (activeStatuses.length > 0 && !activeStatuses.includes(v.status)) return false;
      if (budgetMax && v.budgetEstimate > Number(budgetMax)) return false;
      if (guestMin && v.guestMax < Number(guestMin)) return false;
      if (search) {
        const term = search.toLowerCase();
        if (
          !v.name.toLowerCase().includes(term) &&
          !v.notes.toLowerCase().includes(term)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [venues, activeStatuses, budgetMax, guestMin, search, hideRejected]);

  const columns = useMemo<ColumnDef<Venue>[]>(
    () => [
      {
        id: "thumbnail",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const venue = row.original;
          return (
            <VenueGalleryDialog
              name={venue.name}
              images={venue.images}
              coverImage={venue.coverImage}
            />
          );
        },
      },
      {
        accessorKey: "name",
        header: "Venue",
        cell: ({ row }) => {
          const venue = row.original;
          return (
            <EditableText
              value={venue.name}
              onSave={(name) => updateVenue(workspace!.id, venue.id, { name })}
              placeholder="Venue name"
              className="font-medium text-foreground"
            />
          );
        },
      },
      {
        accessorKey: "location",
        header: "Location",
        cell: ({ row }) => {
          const venue = row.original;
          return (
            <EditableText
              value={venue.location}
              onSave={(location) => updateVenue(workspace!.id, venue.id, { location })}
              placeholder="Location"
            />
          );
        },
      },
      {
        accessorKey: "budgetEstimate",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Budget estimate <ArrowUpDown className="size-3.5" />
          </button>
        ),
        cell: ({ row }) => {
          const venue = row.original;
          return (
            <EditableNumber
              value={venue.budgetEstimate}
              onSave={(budgetEstimate) => updateVenue(workspace!.id, venue.id, { budgetEstimate })}
              formatDisplay={formatIDR}
            />
          );
        },
      },
      {
        accessorKey: "guestMax",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Guest max <ArrowUpDown className="size-3.5" />
          </button>
        ),
        cell: ({ row }) => {
          const venue = row.original;
          return (
            <EditableNumber
              value={venue.guestMax}
              onSave={(guestMax) => updateVenue(workspace!.id, venue.id, { guestMax })}
              formatDisplay={(v) => `${v} guests`}
            />
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const venue = row.original;
          return (
            <VenueStatusPill
              value={venue.status}
              onChange={(status) => updateVenue(workspace!.id, venue.id, { status })}
            />
          );
        },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        enableSorting: false,
        cell: ({ row }) => {
          const venue = row.original;
          return (
            <VenueNotesCell
              value={venue.notes}
              onSave={(notes) => updateVenue(workspace!.id, venue.id, { notes })}
            />
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const venue = row.original;
          const alreadyLinked = linkedVenueIds.has(venue.id);
          return (
            <div className="flex items-center gap-1.5">
              {venue.status === "Booked" && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={alreadyLinked}
                        className={alreadyLinked ? "text-emerald-600" : "text-muted-foreground"}
                        onClick={() => createBudgetItemFromVenue(workspace!.id, venue)}
                      />
                    }
                  >
                    <PiggyBank className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {alreadyLinked ? "Already added to budget" : "Add to budget"}
                  </TooltipContent>
                </Tooltip>
              )}
              <CloudinaryUploadButton
                size="icon"
                variant="ghost"
                label="Upload photo"
                onUpload={(url) => addVenueImage(workspace!.id, venue, url)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => deleteVenue(workspace!.id, venue.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [linkedVenueIds],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Venues</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare, tour and track every venue you&apos;re considering.
          </p>
        </div>
        <Button onClick={() => createVenue(workspace!.id)} className="gap-1.5 self-start sm:self-auto">
          <Plus className="size-4" />
          Add venue
        </Button>
      </div>

      <VenuesToolbar
        search={search}
        onSearchChange={setSearch}
        activeStatuses={activeStatuses}
        onToggleStatus={toggleStatus}
        budgetMax={budgetMax}
        onBudgetMaxChange={setBudgetMax}
        guestMin={guestMin}
        onGuestMinChange={setGuestMin}
        hideRejected={hideRejected}
        onHideRejectedChange={setHideRejected}
      />

      <Card className="overflow-hidden border-border/70 p-0 shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="py-10 text-center text-muted-foreground">
                    No venues match your filters yet.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="transition-colors hover:bg-accent/30">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="align-top">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
