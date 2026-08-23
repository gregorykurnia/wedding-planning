"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  createBudgetItem,
  deleteBudgetItem,
  updateBudgetItem,
  useBudgetItems,
} from "@/lib/collections/budget-items";
import { formatIDR } from "@/lib/format";
import type { PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAYMENT_OPTIONS: PaymentStatus[] = ["unpaid", "deposit", "paid"];
const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  unpaid: "bg-rose-100 text-rose-800 border-rose-200",
  deposit: "bg-amber-100 text-amber-800 border-amber-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
};
const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  deposit: "Deposit paid",
  paid: "Fully paid",
};

export default function BudgetPage() {
  const { data: items, loading } = useBudgetItems();
  const totalEstimated = items.reduce((sum, i) => sum + i.estimatedAmount, 0);
  const totalActual = items.reduce((sum, i) => sum + i.actualAmount, 0);
  const remaining = totalEstimated - totalActual;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Budget</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track estimated vs. actual spend across every category.
          </p>
        </div>
        <Button onClick={() => createBudgetItem()} className="gap-1.5 self-start sm:self-auto">
          <Plus className="size-4" />
          Add category
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/70 bg-gradient-to-br from-blush/50 to-card shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total estimated</p>
            <p className="font-heading text-2xl font-semibold text-foreground">
              {formatIDR(totalEstimated)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total spent</p>
            <p className="font-heading text-2xl font-semibold text-foreground">
              {formatIDR(totalActual)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p
              className={cn(
                "font-heading text-2xl font-semibold",
                remaining < 0 ? "text-destructive" : "text-foreground",
              )}
            >
              {formatIDR(remaining)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/70 p-0 shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estimated</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actual</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment status</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</TableHead>
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
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No budget categories yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} className="transition-colors hover:bg-accent/30">
                    <TableCell className="align-top font-medium">
                      <div className="flex items-center gap-1.5">
                        <EditableText
                          value={item.category}
                          onSave={(category) => updateBudgetItem(item.id, { category })}
                        />
                        {(item.linkedVenueId || item.linkedVendorId) && (
                          <span
                            title="Linked to a confirmed booking"
                            className="mt-1.5 shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800"
                          >
                            Confirmed
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <EditableNumber
                        value={item.estimatedAmount}
                        onSave={(estimatedAmount) =>
                          updateBudgetItem(item.id, { estimatedAmount })
                        }
                        formatDisplay={formatIDR}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <EditableNumber
                        value={item.actualAmount}
                        onSave={(actualAmount) => updateBudgetItem(item.id, { actualAmount })}
                        formatDisplay={formatIDR}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Select
                        value={item.paymentStatus}
                        onValueChange={(v) =>
                          updateBudgetItem(item.id, { paymentStatus: v as PaymentStatus })
                        }
                      >
                        <SelectTrigger
                          size="sm"
                          className={cn(
                            "h-7 w-auto gap-1 rounded-full border px-3 text-xs font-medium shadow-none",
                            PAYMENT_STYLES[item.paymentStatus],
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {PAYMENT_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top min-w-[180px]">
                      <EditableText
                        value={item.notes}
                        onSave={(notes) => updateBudgetItem(item.id, { notes })}
                        placeholder="—"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => deleteBudgetItem(item.id)}
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
