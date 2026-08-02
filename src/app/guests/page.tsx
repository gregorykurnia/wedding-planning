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
import { ArrowUpDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { Guest, RsvpStatus } from "@/lib/types";
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
  const attending = guests.filter((g) => g.rsvpStatus === "yes").length;
  const totalHeadcount = guests
    .filter((g) => g.rsvpStatus === "yes")
    .reduce((sum, g) => sum + 1 + g.plusOnes, 0);

  const columns = useMemo<ColumnDef<Guest>[]>(
    () => [
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
    [],
  );

  const table = useReactTable({
    data: guests,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Guests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {guests.length} listed · {attending} attending · {totalHeadcount} total headcount with plus-ones
          </p>
        </div>
        <Button onClick={() => createGuest()} className="gap-1.5 self-start sm:self-auto">
          <Plus className="size-4" />
          Add guest
        </Button>
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
                    No guests added yet.
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
