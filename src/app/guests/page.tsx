"use client";

import { Plus, Trash2 } from "lucide-react";
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
import type { RsvpStatus } from "@/lib/types";
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

export default function GuestsPage() {
  const { data: guests, loading } = useGuests();
  const attending = guests.filter((g) => g.rsvpStatus === "yes").length;
  const totalHeadcount = guests
    .filter((g) => g.rsvpStatus === "yes")
    .reduce((sum, g) => sum + 1 + g.plusOnes, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Guests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {attending} attending · {totalHeadcount} total headcount with plus-ones
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
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">RSVP</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meal choice</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plus-ones</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Table</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : guests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No guests added yet.
                  </TableCell>
                </TableRow>
              ) : (
                guests.map((guest) => (
                  <TableRow key={guest.id} className="transition-colors hover:bg-accent/30">
                    <TableCell className="align-top font-medium">
                      <EditableText
                        value={guest.name}
                        onSave={(name) => updateGuest(guest.id, { name })}
                        placeholder="Guest name"
                      />
                    </TableCell>
                    <TableCell className="align-top">
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
                    </TableCell>
                    <TableCell className="align-top">
                      <EditableText
                        value={guest.mealChoice}
                        onSave={(mealChoice) => updateGuest(guest.id, { mealChoice })}
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <EditableNumber
                        value={guest.plusOnes}
                        onSave={(plusOnes) => updateGuest(guest.id, { plusOnes })}
                        formatDisplay={(v) => String(v)}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <EditableText
                        value={guest.tableAssignment}
                        onSave={(tableAssignment) => updateGuest(guest.id, { tableAssignment })}
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => deleteGuest(guest.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
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
