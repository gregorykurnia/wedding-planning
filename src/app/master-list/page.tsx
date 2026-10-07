"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Filter,
  Plus,
  Search,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MasterListEditableCell } from "@/components/master-list/master-list-editable-cell";
import { MasterListMultiSelect } from "@/components/master-list/master-list-multi-select";
import {
  addMasterListItems,
  deleteMasterListItem,
  ensureMasterListInitialized,
  MASTER_LIST_PERSON_OPTIONS,
  MASTER_LIST_TYPE_OPTIONS,
  restoreMasterListItem,
  updateMasterListItem,
  useMasterListItems,
} from "@/lib/collections/master-list";
import { isFirebaseConfigured } from "@/lib/firebase";
import type {
  MasterListItem,
  MasterListItemUpdate,
  MasterListPerson,
  MasterListType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ConfirmedFilter = "all" | "yes" | "no";
type NextFilter = "all" | "next" | "not-next";

const CONFIRMED_STYLES = {
  yes: "border-emerald-200 bg-emerald-100 text-emerald-800",
  no: "border-border bg-muted/60 text-muted-foreground",
};

interface MasterListRowProps {
  item: MasterListItem;
  autoFocusItem: boolean;
  onAutoFocusHandled: () => void;
  onSave: (id: string, data: MasterListItemUpdate) => Promise<void>;
  onDelete: (item: MasterListItem) => void;
}

function MasterListRow({
  item,
  autoFocusItem,
  onAutoFocusHandled,
  onSave,
  onDelete,
}: MasterListRowProps) {
  const save = (data: MasterListItemUpdate) => onSave(item.id, data);

  return (
    <TableRow
      data-master-row-id={item.id}
      className={cn(
        "transition-colors hover:bg-accent/25",
        item.next && "bg-accent/25 hover:bg-accent/40",
      )}
    >
      <TableCell
        className={cn(
          "sticky left-0 z-10 w-[250px] min-w-[250px] max-w-[250px] align-top whitespace-normal shadow-[6px_0_10px_-10px_color-mix(in_oklab,var(--foreground)_35%,transparent)]",
          item.next ? "bg-accent/25" : "bg-card",
        )}
      >
        <MasterListEditableCell
          value={item.item}
          label="Item"
          placeholder="Add item"
          autoFocus={autoFocusItem}
          onAutoFocusHandled={onAutoFocusHandled}
          onSave={(value) => save({ item: value })}
          className="font-medium text-foreground"
        />
      </TableCell>
      <TableCell className="w-[220px] min-w-[220px] max-w-[220px] align-top whitespace-normal">
        <MasterListEditableCell
          value={item.vendor}
          label="Vendor"
          placeholder="—"
          onSave={(value) => save({ vendor: value })}
        />
      </TableCell>
      <TableCell className="w-[130px] min-w-[130px] align-top">
        <Select
          value={item.confirmed ? "yes" : "no"}
          onValueChange={(value) => {
            void save({ confirmed: value === "yes" }).catch(() => undefined);
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label={`Confirmed status for ${item.item || "item"}`}
            className={cn(
              "h-7 w-auto gap-1 rounded-full border px-3 text-xs font-medium shadow-none",
              CONFIRMED_STYLES[item.confirmed ? "yes" : "no"],
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="w-[210px] min-w-[210px] align-top whitespace-normal">
        <MasterListMultiSelect
          label="Type"
          options={MASTER_LIST_TYPE_OPTIONS}
          value={item.types}
          onChange={(types) => save({ types: types as MasterListType[] })}
          placeholder="Add types"
          className="w-full border-transparent bg-transparent dark:bg-transparent"
        />
      </TableCell>
      <TableCell className="w-[230px] min-w-[230px] align-top whitespace-normal">
        <MasterListMultiSelect
          label="Person"
          options={MASTER_LIST_PERSON_OPTIONS}
          value={item.persons}
          onChange={(persons) => save({ persons: persons as MasterListPerson[] })}
          placeholder="Add people"
          className="w-full border-transparent bg-transparent dark:bg-transparent"
        />
      </TableCell>
      <TableCell className="w-[76px] min-w-[76px] align-top text-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={item.next ? `Clear Next for ${item.item || "item"}` : `Mark ${item.item || "item"} as Next`}
          aria-pressed={item.next}
          title={item.next ? "Clear Next" : "Mark as Next"}
          className={cn(
            "rounded-full text-muted-foreground hover:bg-accent hover:text-foreground",
            item.next && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
          )}
          onClick={() => {
            void save({ next: !item.next }).catch(() => undefined);
          }}
        >
          <Star className={cn("size-4", item.next && "fill-current")} />
        </Button>
      </TableCell>
      <TableCell className="w-[58px] min-w-[58px] align-top text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${item.item || "item"}`}
          title="Delete item"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(item)}
        >
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell className="sticky left-0 z-10 bg-card">
            <Skeleton className="h-7 w-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-7 w-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-7 w-16 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-7 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-7 w-36" />
          </TableCell>
          <TableCell>
            <Skeleton className="mx-auto size-7 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="ml-auto size-7 rounded-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function MasterListPage() {
  const { data: items, loading, error: loadError } = useMasterListItems();
  const [initializing, setInitializing] = useState(isFirebaseConfigured);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmedFilter, setConfirmedFilter] = useState<ConfirmedFilter>("all");
  const [typeFilter, setTypeFilter] = useState<MasterListType[]>([]);
  const [personFilter, setPersonFilter] = useState<MasterListPerson[]>([]);
  const [nextFilter, setNextFilter] = useState<NextFilter>("all");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [bulkCount, setBulkCount] = useState("5");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MasterListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [undoItem, setUndoItem] = useState<MasterListItem | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      return;
    }

    let active = true;
    void ensureMasterListInitialized()
      .catch((error: unknown) => {
        if (active) {
          setInitializationError(
            error instanceof Error ? error.message : "Unable to prepare the Master List.",
          );
        }
      })
      .finally(() => {
        if (active) setInitializing(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((item) => {
      if (term && !`${item.item} ${item.vendor}`.toLowerCase().includes(term)) return false;
      if (confirmedFilter === "yes" && !item.confirmed) return false;
      if (confirmedFilter === "no" && item.confirmed) return false;
      if (typeFilter.length > 0 && !typeFilter.some((type) => item.types.includes(type))) return false;
      if (personFilter.length > 0 && !personFilter.some((person) => item.persons.includes(person))) return false;
      if (nextFilter === "next" && !item.next) return false;
      if (nextFilter === "not-next" && item.next) return false;
      return true;
    });
  }, [confirmedFilter, items, nextFilter, personFilter, search, typeFilter]);

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (confirmedFilter !== "all" ? 1 : 0) +
    (typeFilter.length > 0 ? 1 : 0) +
    (personFilter.length > 0 ? 1 : 0) +
    (nextFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setConfirmedFilter("all");
    setTypeFilter([]);
    setPersonFilter([]);
    setNextFilter("all");
  };

  const saveRow = async (id: string, data: MasterListItemUpdate) => {
    setSaveError(null);
    try {
      await updateMasterListItem(id, data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save this change.";
      setSaveError(message);
      throw error;
    }
  };

  const addRows = async (count: number) => {
    setSaveError(null);
    try {
      const ids = await addMasterListItems(count);
      setFocusRowId(ids[0] ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to add rows.";
      setSaveError(message);
      throw error;
    }
  };

  const requestDelete = (item: MasterListItem) => {
    setDeleteError(null);
    setDeleteTarget(item);
  };

  const scheduleUndo = (item: MasterListItem) => {
    if (undoTimerRef.current !== null) clearTimeout(undoTimerRef.current);
    setUndoItem(item);
    setUndoError(null);
    undoTimerRef.current = setTimeout(() => {
      setUndoItem((current) => (current?.id === item.id ? null : current));
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
      await deleteMasterListItem(target.id);
      setDeleteTarget(null);
      scheduleUndo(target);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete this item.");
    } finally {
      setIsDeleting(false);
    }
  };

  const undoDelete = async () => {
    if (!undoItem || isRestoring) return;
    const target = undoItem;
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setIsRestoring(true);
    setUndoError(null);
    try {
      await restoreMasterListItem(target);
      setUndoItem(null);
    } catch (error) {
      setUndoError(error instanceof Error ? error.message : "Unable to restore this item.");
    } finally {
      setIsRestoring(false);
    }
  };

  const submitBulkAdd = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const count = Number(bulkCount);
    if (!/^\d+$/.test(bulkCount) || !Number.isInteger(count) || count < 1 || count > 50) {
      setBulkError("Enter a whole number from 1 to 50.");
      return;
    }

    setBulkError(null);
    setIsAdding(true);
    try {
      await addRows(count);
      setIsAddDialogOpen(false);
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Unable to add rows.");
    } finally {
      setIsAdding(false);
    }
  };

  const loadErrorMessage = loadError ?? initializationError;
  const isPreparing = loading || initializing;
  const confirmedCount = items.filter((item) => item.confirmed).length;
  const nextCount = items.filter((item) => item.next).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-3xl font-semibold text-foreground">Master List</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Keep every wedding detail in one ordered checklist. Click a cell to edit, use the star for what&apos;s next, and filter the list as you plan.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-600" />
              {confirmedCount} confirmed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="size-3.5 text-primary" />
              {nextCount} next
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={!isFirebaseConfigured || isAdding || initializing}
            onClick={() => {
              void addRows(1).catch(() => undefined);
            }}
          >
            <Plus className="size-4" />
            Add row
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            disabled={!isFirebaseConfigured || isAdding || initializing}
            onClick={() => {
              setBulkCount("5");
              setBulkError(null);
              setIsAddDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add multiple rows
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          This change could not be saved. {saveError}
        </div>
      )}

      {loadErrorMessage && (
        <Card className="border-destructive/30 bg-destructive/5 p-4 shadow-sm">
          <p className="text-sm font-medium text-destructive">We couldn&apos;t load the Master List.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your connection and try again. {loadErrorMessage}
          </p>
        </Card>
      )}

      <Card className="gap-3 border-border/70 p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search items or vendors…"
              aria-label="Search items or vendors"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex min-w-[9.5rem] flex-1 items-center gap-1.5 sm:flex-none">
              <Filter className="hidden size-3.5 shrink-0 text-muted-foreground sm:block" />
              <Select value={confirmedFilter} onValueChange={(value) => setConfirmedFilter(value as ConfirmedFilter)}>
                <SelectTrigger size="sm" className="h-9 w-full sm:w-[9.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Confirmed: All</SelectItem>
                  <SelectItem value="yes">Confirmed: Yes</SelectItem>
                  <SelectItem value="no">Confirmed: No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <MasterListMultiSelect
              label="Type"
              options={MASTER_LIST_TYPE_OPTIONS}
              value={typeFilter}
              onChange={(value) => setTypeFilter(value as MasterListType[])}
              placeholder="Type: All"
              filterStyle
              className="min-w-[9.5rem] flex-1 sm:flex-none"
            />
            <MasterListMultiSelect
              label="Person"
              options={MASTER_LIST_PERSON_OPTIONS}
              value={personFilter}
              onChange={(value) => setPersonFilter(value as MasterListPerson[])}
              placeholder="Person: All"
              filterStyle
              className="min-w-[9.5rem] flex-1 sm:flex-none"
            />
            <Select value={nextFilter} onValueChange={(value) => setNextFilter(value as NextFilter)}>
              <SelectTrigger size="sm" className="h-9 min-w-[8rem] flex-1 sm:flex-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Next: All</SelectItem>
                <SelectItem value="next">Next: Yes</SelectItem>
                <SelectItem value="not-next">Next: No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2 text-xs text-muted-foreground">
          <span>
            Showing {filteredItems.length} of {items.length} {items.length === 1 ? "item" : "items"}
          </span>
          {activeFilterCount > 0 && (
            <Button type="button" variant="ghost" size="xs" className="h-6 gap-1 px-2" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden border-border/70 p-0 shadow-sm">
        <div className="overflow-x-auto">
          <Table className="min-w-[1174px] table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="sticky left-0 z-20 w-[250px] min-w-[250px] bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-[6px_0_10px_-10px_color-mix(in_oklab,var(--foreground)_35%,transparent)]">
                  Item
                </TableHead>
                <TableHead className="w-[220px] min-w-[220px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vendor
                </TableHead>
                <TableHead className="w-[130px] min-w-[130px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Confirmed/Not
                </TableHead>
                <TableHead className="w-[210px] min-w-[210px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Type
                </TableHead>
                <TableHead className="w-[230px] min-w-[230px] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Person
                </TableHead>
                <TableHead className="w-[76px] min-w-[76px] text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Next?
                </TableHead>
                <TableHead className="w-[58px] min-w-[58px] text-right" aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPreparing ? (
                <LoadingRows />
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 whitespace-normal text-center text-muted-foreground">
                    {items.length === 0
                      ? "No Master List rows yet. Add a row to get started."
                      : "No rows match the current search and filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <MasterListRow
                    key={item.id}
                    item={item}
                    autoFocusItem={focusRowId === item.id}
                    onAutoFocusHandled={() => setFocusRowId(null)}
                    onSave={saveRow}
                    onDelete={requestDelete}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center gap-2 border-t border-border/70 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <Star className="size-3.5 shrink-0 text-primary" />
          <span>Starred rows stay in their original order and receive a soft highlight.</span>
        </div>
      </Card>

      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isAdding) {
            setIsAddDialogOpen(false);
            setBulkError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add multiple rows</DialogTitle>
            <DialogDescription>
              Add between 1 and 50 blank rows to the end of the Master List. The first new Item cell will be focused after saving.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitBulkAdd} className="flex flex-col gap-2">
            <label htmlFor="master-list-row-count" className="text-sm font-medium text-foreground">
              Number of rows
            </label>
            <Input
              id="master-list-row-count"
              type="number"
              min={1}
              max={50}
              step={1}
              value={bulkCount}
              onChange={(event) => setBulkCount(event.target.value)}
              aria-invalid={Boolean(bulkError)}
              aria-describedby={bulkError ? "master-list-row-count-error" : undefined}
              autoFocus
            />
            {bulkError && (
              <p id="master-list-row-count-error" className="text-sm text-destructive" role="alert">
                {bulkError}
              </p>
            )}
            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                disabled={isAdding}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isAdding}>
                {isAdding ? "Adding…" : "Add rows"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
            <DialogTitle>Delete Master List row?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Remove “${deleteTarget.item || "this blank row"}” from the Master List? You can undo this for 10 seconds after deletion.`
                : "This row will be removed from the Master List."}
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
              {isDeleting ? "Deleting…" : "Delete row"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {undoItem && (
        <div
          className="fixed inset-x-4 bottom-20 z-50 flex items-center gap-3 rounded-xl bg-popover px-4 py-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10 sm:inset-x-auto sm:right-4 sm:max-w-sm"
          role="status"
          aria-live="polite"
        >
          <Undo2 className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              Deleted “{undoItem.item || "blank row"}”.
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
    </div>
  );
}
