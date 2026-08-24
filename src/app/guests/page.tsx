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
import { ArrowUpDown, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditableText } from "@/components/shared/editable-text";
import { EditableNumber } from "@/components/shared/editable-number";
import {
  createGuest,
  deleteGuest,
  updateGuest,
  useGuests,
} from "@/lib/collections/guests";
import type { EventType, Guest, RsvpStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const RSVP_OPTIONS: RsvpStatus[] = ["pending", "yes", "no"];
const RSVP_STYLES: Record<RsvpStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  yes: "bg-emerald-100 text-emerald-800 border-emerald-200",
  no: "bg-rose-100 text-rose-800 border-rose-200",
};
const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: "Pending",
  yes: "Attending",
  no: "Not attending",
};

const EVENT_OPTIONS: EventType[] = ["Both", "Matrimony", "Reception", "Reception Shortlist", "Unsure (Abroad)"];
const EVENT_STYLES: Record<EventType, string> = {
  Both: "bg-sky-100 text-sky-800 border-sky-200",
  Matrimony: "bg-violet-100 text-violet-800 border-violet-200",
  Reception: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  "Reception Shortlist": "bg-amber-100 text-amber-800 border-amber-200",
  "Unsure (Abroad)": "bg-gray-100 text-gray-700 border-gray-200",
};

const RSVP_FILTER_OPTIONS = ["all", ...RSVP_OPTIONS] as const;
const EVENT_FILTER_OPTIONS = ["all", ...EVENT_OPTIONS] as const;

function SortableHeader({ label, column }: { label: string; column: { toggleSorting: (desc: boolean) => void; getIsSorted: () => false | "asc" | "desc" } }) {
  return (
    <button
      className="flex items-center gap-1"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label} <ArrowUpDown className="size-3.5" />
    </button>
  );
}

export default function GuestsPage() {
  const { data: guests, loading } = useGuests();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rsvpFilter, setRsvpFilter] = useState<(typeof RSVP_FILTER_OPTIONS)[number]>("all");
  const [eventFilter, setEventFilter] = useState<(typeof EVENT_FILTER_OPTIONS)[number]>("all");
  const [search, setSearch] = useState("");
  const attending = guests.filter((g) => g.rsvpStatus === "yes").length;
  const totalListed = guests.reduce((sum, g) => sum + 1 + g.plusOnes, 0);
  const totalHeadcount = guests
    .filter((g) => g.rsvpStatus === "yes")
    .reduce((sum, g) => sum + 1 + g.plusOnes, 0);
  const bothCount = guests
    .filter((g) => g.eventType === "Both")
    .reduce((sum, g) => sum + 1 + g.plusOnes, 0);
  const receptionCount = guests
    .filter((g) => g.eventType === "Reception" || g.eventType === "Both")
    .reduce((sum, g) => sum + 1 + g.plusOnes, 0);
  const matrimonyCount = guests
    .filter(
      (g) =>
        g.eventType === "Matrimony" ||
        g.eventType === "Both" ||
        g.eventType === "Reception Shortlist"
    )
    .reduce((sum, g) => sum + 1 + g.plusOnes, 0);

  const orderIndex = useMemo(() => {
    const map = new Map<string, number>();
    guests.forEach((g, i) => map.set(g.id, i + 1));
    return map;
  }, [guests]);

  const filteredGuests = useMemo(() => {
    const term = search.trim().toLowerCase();
    return guests.filter((g) => {
      if (rsvpFilter !== "all" && g.rsvpStatus !== rsvpFilter) return false;
      if (eventFilter !== "all" && g.eventType !== eventFilter) return false;
      if (term) {
        const haystack = `${g.name} ${g.connection} ${g.country} ${g.allergies}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [guests, rsvpFilter, eventFilter, search]);

  const columns = useMemo<ColumnDef<Guest>[]>(
    () => [
      {
        id: "number",
        header: "Number",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{orderIndex.get(row.original.id)}</span>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => <SortableHeader label="Name" column={column} />,
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <EditableText
              value={guest.name}
              onSave={(name) => updateGuest(guest.id, { name })}
              placeholder="Guest name"
              className="font-medium text-foreground"
            />
          );
        },
      },
      {
        accessorKey: "connection",
        header: ({ column }) => <SortableHeader label="Connection" column={column} />,
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <EditableText
              value={guest.connection}
              onSave={(connection) => updateGuest(guest.id, { connection })}
              placeholder="—"
            />
          );
        },
      },
      {
        accessorKey: "country",
        header: ({ column }) => <SortableHeader label="Country" column={column} />,
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <EditableText
              value={guest.country}
              onSave={(country) => updateGuest(guest.id, { country })}
              placeholder="—"
            />
          );
        },
      },
      {
        accessorKey: "rsvpStatus",
        header: ({ column }) => <SortableHeader label="RSVP" column={column} />,
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <Select
              value={guest.rsvpStatus}
              onValueChange={(v) =>
                updateGuest(guest.id, { rsvpStatus: v as RsvpStatus })
              }
            >
              <SelectTrigger
                size="sm"
                className={cn(
                  "h-7 w-auto gap-1 rounded-full border px-3 text-xs font-medium shadow-none",
                  RSVP_STYLES[guest.rsvpStatus],
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RSVP_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {RSVP_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        accessorKey: "eventType",
        header: ({ column }) => <SortableHeader label="Event" column={column} />,
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <Select
              value={guest.eventType}
              onValueChange={(v) =>
                updateGuest(guest.id, { eventType: v as EventType })
              }
            >
              <SelectTrigger
                size="sm"
                className={cn(
                  "h-7 w-auto gap-1 rounded-full border px-3 text-xs font-medium shadow-none",
                  EVENT_STYLES[guest.eventType],
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
      },
      {
        accessorKey: "inviteSent",
        header: ({ column }) => <SortableHeader label="Invite Sent" column={column} />,
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <Checkbox
              checked={guest.inviteSent}
              onCheckedChange={(checked) =>
                updateGuest(guest.id, { inviteSent: checked === true })
              }
            />
          );
        },
      },
      {
        accessorKey: "plusOnes",
        header: ({ column }) => <SortableHeader label="Plus Ones" column={column} />,
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <EditableNumber
              value={guest.plusOnes}
              onSave={(plusOnes) => updateGuest(guest.id, { plusOnes })}
              formatDisplay={(v) => String(v)}
            />
          );
        },
      },
      {
        accessorKey: "allergies",
        header: ({ column }) => <SortableHeader label="Food Notes" column={column} />,
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <EditableText
              value={guest.allergies}
              onSave={(allergies) => updateGuest(guest.id, { allergies })}
              placeholder="—"
            />
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const guest = row.original;
          return (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => deleteGuest(guest.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          );
        },
      },
    ],
    [orderIndex],
  );

  const table = useReactTable({
    data: filteredGuests,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Without this, rows key off array position, so a guest reordering
    // (e.g. a new row's createdAt resolving from a pending server
    // timestamp to its real value) remounts whichever cell happens to
    // land at that index mid-edit, dropping focus/caret.
    getRowId: (row) => row.id,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Guests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalListed} listed (incl. plus-ones) · {attending} attending · {totalHeadcount} total headcount with plus-ones
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {bothCount} both · {receptionCount} reception · {matrimonyCount} matrimony
          </p>
        </div>
        <Button onClick={() => createGuest()} className="gap-1.5 self-start sm:self-auto">
          <Plus className="size-4" />
          Add guest
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guests..."
            className="h-8 pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">RSVP</span>
          <Select value={rsvpFilter} onValueChange={(v) => setRsvpFilter(v as typeof rsvpFilter)}>
            <SelectTrigger size="sm" className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {RSVP_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {RSVP_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Event</span>
          <Select value={eventFilter} onValueChange={(v) => setEventFilter(v as typeof eventFilter)}>
            <SelectTrigger size="sm" className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {EVENT_OPTIONS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
                    {guests.length === 0 ? "No guests added yet." : "No guests match the current filters."}
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

      <Button
        onClick={() => createGuest()}
        className="fixed bottom-4 right-4 z-50 gap-1.5 rounded-full shadow-lg"
        size="lg"
      >
        <Plus className="size-4" />
        Add guest
      </Button>
    </div>
  );
}
