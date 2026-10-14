"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Plus, Search, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  restoreGuest,
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

const BUSINESS_CONNECTION_TERMS = [
  "friend",
  "friends",
  "work",
  "business",
  "colleague",
  "colleagues",
  "coworker",
  "coworkers",
  "co-worker",
  "co-workers",
  "client",
  "clients",
  "customer",
  "customers",
  "boss",
  "manager",
  "office",
  "professional",
  "professionals",
  "network",
  "networking",
  "contact",
  "contacts",
  "partner",
  "partners",
  "classmate",
  "classmates",
] as const;

function normalizedConnection(connection: string) {
  return connection.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasBusinessConnectionTag(connection: string) {
  const normalized = normalizedConnection(connection);
  return BUSINESS_CONNECTION_TERMS.some((term) =>
    new RegExp(`\\b${term.replace("-", "\\-")}\\b`).test(normalized),
  );
}

function hasPersonTag(connection: string, person: "groom" | "bride") {
  return new RegExp(`\\b${person}\\b`).test(normalizedConnection(connection));
}

function guestHeadcount(guest: Guest) {
  return 1 + guest.plusOnes;
}

function isGroomBusinessConnection(guest: Guest) {
  return hasPersonTag(guest.connection, "groom") && hasBusinessConnectionTag(guest.connection);
}

function isGroomBigFamily(guest: Guest) {
  return hasPersonTag(guest.connection, "groom") && !isGroomBusinessConnection(guest);
}

function isBrideBigFamily(guest: Guest) {
  return hasPersonTag(guest.connection, "bride") && !hasBusinessConnectionTag(guest.connection);
}

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

function GuestActions({ guest, onDelete }: { guest: Guest; onDelete: (guest: Guest) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${guest.name || "guest"}`}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={() => onDelete(guest)} variant="destructive">
          <Trash2 className="size-4" />
          Delete guest
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GuestMobileCard({
  guest,
  orderNumber,
  onDelete,
}: {
  guest: Guest;
  orderNumber: number | undefined;
  onDelete: (guest: Guest) => void;
}) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {orderNumber !== undefined && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                #{orderNumber}
              </span>
            )}
            <EditableText
              value={guest.name}
              onSave={(name) => updateGuest(guest.id, { name })}
              placeholder="Guest name"
              className="font-semibold text-foreground"
            />
          </div>
          <EditableText
            value={guest.connection}
            onSave={(connection) => updateGuest(guest.id, { connection })}
            placeholder="Add connection"
            className="text-xs text-muted-foreground"
          />
        </div>
        <GuestActions guest={guest} onDelete={onDelete} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={guest.rsvpStatus}
          onValueChange={(value) => updateGuest(guest.id, { rsvpStatus: value as RsvpStatus })}
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
            {RSVP_OPTIONS.map((status) => (
              <SelectItem key={status} value={status}>
                {RSVP_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={guest.eventType}
          onValueChange={(value) => updateGuest(guest.id, { eventType: value as EventType })}
        >
          <SelectTrigger
            size="sm"
            className={cn(
              "h-7 w-auto max-w-full gap-1 rounded-full border px-3 text-xs font-medium shadow-none",
              EVENT_STYLES[guest.eventType],
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_OPTIONS.map((event) => (
              <SelectItem key={event} value={event}>
                {event}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-border/70 pt-3">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Country
          </p>
          <EditableText
            value={guest.country}
            onSave={(country) => updateGuest(guest.id, { country })}
            placeholder="—"
            className="-mx-2 w-[calc(100%+1rem)]"
          />
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Plus ones
          </p>
          <EditableNumber
            value={guest.plusOnes}
            onSave={(plusOnes) => updateGuest(guest.id, { plusOnes })}
            formatDisplay={(value) => `${value} · ${guestHeadcount(guest)} total`}
            className="-mx-2 w-[calc(100%+1rem)]"
          />
        </div>
        <label className="col-span-2 flex min-h-8 items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={guest.inviteSent}
            onCheckedChange={(checked) => updateGuest(guest.id, { inviteSent: checked === true })}
          />
          Invite sent
        </label>
        <div className="col-span-2 min-w-0">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Food notes
          </p>
          <EditableText
            value={guest.allergies}
            onSave={(allergies) => updateGuest(guest.id, { allergies })}
            placeholder="—"
            className="-mx-2 w-[calc(100%+1rem)]"
          />
        </div>
      </div>
    </Card>
  );
}

export default function GuestsPage() {
  const { data: guests, loading } = useGuests();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rsvpFilter, setRsvpFilter] = useState<(typeof RSVP_FILTER_OPTIONS)[number]>("all");
  const [eventFilter, setEventFilter] = useState<(typeof EVENT_FILTER_OPTIONS)[number]>("all");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Guest | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [undoGuest, setUndoGuest] = useState<Guest | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const requestDelete = (guest: Guest) => {
    setDeleteError(null);
    setDeleteTarget(guest);
  };

  const scheduleUndo = (guest: Guest) => {
    if (undoTimerRef.current !== null) clearTimeout(undoTimerRef.current);
    setUndoError(null);
    setUndoGuest(guest);
    undoTimerRef.current = setTimeout(() => {
      setUndoGuest((current) => (current?.id === guest.id ? null : current));
      setUndoError(null);
      undoTimerRef.current = null;
    }, 10000);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    const target = deleteTarget;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteGuest(target.id);
      setDeleteTarget(null);
      scheduleUndo(target);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete this guest.");
    } finally {
      setIsDeleting(false);
    }
  };

  const undoDelete = async () => {
    if (!undoGuest || isRestoring) return;
    const target = undoGuest;
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setIsRestoring(true);
    setUndoError(null);
    try {
      await restoreGuest(target);
      setUndoGuest(null);
    } catch (error) {
      setUndoError(error instanceof Error ? error.message : "Unable to restore this guest.");
    } finally {
      setIsRestoring(false);
    }
  };

  const attending = guests.filter((g) => g.rsvpStatus === "yes").length;
  const totalListed = guests.reduce((sum, g) => sum + guestHeadcount(g), 0);
  const totalHeadcount = guests
    .filter((g) => g.rsvpStatus === "yes")
    .reduce((sum, g) => sum + guestHeadcount(g), 0);
  const bothCount = guests
    .filter((g) => g.eventType === "Both")
    .reduce((sum, g) => sum + guestHeadcount(g), 0);
  const receptionCount = guests
    .filter((g) => g.eventType === "Reception" || g.eventType === "Both")
    .reduce((sum, g) => sum + guestHeadcount(g), 0);
  const matrimonyCount = guests
    .filter(
      (g) =>
        g.eventType === "Matrimony" ||
        g.eventType === "Both" ||
        g.eventType === "Reception Shortlist"
    )
    .reduce((sum, g) => sum + guestHeadcount(g), 0);

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

  const bothGroupCounts = useMemo(() => {
    if (eventFilter !== "Both") return null;

    return {
      groomBigFamily: filteredGuests
        .filter(isGroomBigFamily)
        .reduce((sum, guest) => sum + guestHeadcount(guest), 0),
      brideBigFamily: filteredGuests
        .filter(isBrideBigFamily)
        .reduce((sum, guest) => sum + guestHeadcount(guest), 0),
      groomBusinessConnections: filteredGuests
        .filter(isGroomBusinessConnection)
        .reduce((sum, guest) => sum + guestHeadcount(guest), 0),
    };
  }, [eventFilter, filteredGuests]);

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
              onClick={() => requestDelete(guest)}
              aria-label={`Delete ${guest.name || "guest"}`}
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
  const displayedGuests = table.getRowModel().rows.map((row) => row.original);

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
          {bothGroupCounts && (
            <p className="mt-1 text-sm text-muted-foreground">
              Groom Big Family: {bothGroupCounts.groomBigFamily} incl. plus-ones · Bride Big Family: {bothGroupCounts.brideBigFamily} incl. plus-ones · Groom Business Connections: {bothGroupCounts.groomBusinessConnections} incl. plus-ones
            </p>
          )}
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

      <div className="grid gap-3 md:hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="gap-3 p-4">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </Card>
          ))
        ) : displayedGuests.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {guests.length === 0 ? "No guests added yet." : "No guests match the current filters."}
          </Card>
        ) : (
          displayedGuests.map((guest) => (
            <GuestMobileCard
              key={guest.id}
              guest={guest}
              orderNumber={orderIndex.get(guest.id)}
              onDelete={requestDelete}
            />
          ))
        )}
      </div>

      <Card className="hidden overflow-hidden border-border/70 p-0 shadow-sm md:block">
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

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete guest?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This will remove “${deleteTarget.name || "this guest"}” and ${guestHeadcount(deleteTarget) === 1 ? "their entry" : `their entry and ${deleteTarget.plusOnes} plus-ones`} from the guest list. You can undo this for 10 seconds after deletion.`
                : "This guest will be removed from the guest list."}
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting…" : "Delete guest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {undoGuest && (
        <div
          className="fixed inset-x-4 bottom-20 z-50 flex items-center gap-3 rounded-xl bg-popover px-4 py-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10 sm:inset-x-auto sm:right-4 sm:max-w-sm"
          role="status"
          aria-live="polite"
        >
          <Undo2 className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              Deleted “{undoGuest.name || "guest"}”.
            </p>
            {undoError && (
              <p className="mt-0.5 text-xs text-destructive" role="alert">
                {undoError}
              </p>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={undoDelete} disabled={isRestoring}>
            {isRestoring ? "Restoring…" : undoError ? "Retry" : "Undo"}
          </Button>
        </div>
      )}

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
