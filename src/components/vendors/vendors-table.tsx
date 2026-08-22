"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, PiggyBank, Plus, Search, Star, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CloudinaryUploadButton } from "@/components/cloudinary-upload-button";
import { EditableText } from "@/components/shared/editable-text";
import { EditableNumber } from "@/components/shared/editable-number";
import { VenueGalleryDialog } from "@/components/venues/venue-gallery-dialog";
import { VenueNotesCell } from "@/components/venues/venue-notes-cell";
import { VendorCategoryPill } from "@/components/vendors/vendor-category-pill";
import { VendorContractPill } from "@/components/vendors/vendor-contract-pill";
import { VendorCategoryTabs } from "@/components/vendors/vendor-category-tabs";
import { VendorFilesCell } from "@/components/vendors/vendor-files-cell";
import {
  addVendorImage,
  createVendor,
  deleteVendor,
  toggleVendorStar,
  updateVendor,
  useVendors,
} from "@/lib/collections/vendors";
import { createBudgetItemFromVendor, useBudgetItems } from "@/lib/collections/budget-items";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Vendor, VendorCategory } from "@/lib/types";

export function VendorsTable() {
  const { data: vendors, loading } = useVendors();
  const { data: budgetItems } = useBudgetItems();
  const linkedVendorIds = useMemo(
    () => new Set(budgetItems.map((b) => b.linkedVendorId).filter(Boolean)),
    [budgetItems],
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<VendorCategory | "All">("All");
  const [starredOnly, setStarredOnly] = useState(false);

  const counts = useMemo(() => {
    const result: Record<string, number> = { All: vendors.length };
    for (const v of vendors) {
      result[v.category] = (result[v.category] ?? 0) + 1;
    }
    return result;
  }, [vendors]);

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      if (starredOnly && !v.starred) return false;
      if (activeCategory !== "All" && v.category !== activeCategory) return false;
      if (search) {
        const term = search.toLowerCase();
        if (
          !v.name.toLowerCase().includes(term) &&
          !v.notes.toLowerCase().includes(term) &&
          !v.contactName.toLowerCase().includes(term)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [vendors, activeCategory, search, starredOnly]);

  const columns = useMemo<ColumnDef<Vendor>[]>(
    () => [
      {
        id: "star",
        header: "",
        enableSorting: false,
        enableResizing: false,
        size: 40,
        minSize: 40,
        cell: ({ row }) => {
          const vendor = row.original;
          return (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => toggleVendorStar(vendor)}
            >
              <Star
                className={cn(
                  "size-4",
                  vendor.starred
                    ? "fill-yellow-400 text-yellow-500"
                    : "text-muted-foreground",
                )}
              />
            </Button>
          );
        },
      },
      {
        id: "thumbnail",
        header: "",
        enableSorting: false,
        size: 64,
        minSize: 56,
        cell: ({ row }) => {
          const vendor = row.original;
          return (
            <VenueGalleryDialog
              name={vendor.name}
              images={vendor.images}
              coverImage={null}
            />
          );
        },
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Vendor <ArrowUpDown className="size-3.5" />
          </button>
        ),
        size: 240,
        minSize: 160,
        cell: ({ row }) => {
          const vendor = row.original;
          return (
            <div className="flex flex-col gap-1">
              <EditableText
                value={vendor.name}
                onSave={(name) => updateVendor(vendor.id, { name })}
                placeholder="Vendor name"
                className="font-medium text-foreground"
              />
              <div className="flex flex-col text-xs text-muted-foreground">
                <EditableText
                  value={vendor.contactPhone}
                  onSave={(contactPhone) => updateVendor(vendor.id, { contactPhone })}
                  placeholder="Add phone"
                  className="px-0 text-xs"
                />
                <EditableText
                  value={vendor.contactEmail}
                  onSave={(contactEmail) => updateVendor(vendor.id, { contactEmail })}
                  placeholder="Add email"
                  className="px-0 text-xs"
                />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "category",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Type <ArrowUpDown className="size-3.5" />
          </button>
        ),
        size: 160,
        minSize: 130,
        cell: ({ row }) => {
          const vendor = row.original;
          return (
            <VendorCategoryPill
              value={vendor.category}
              onChange={(category) => updateVendor(vendor.id, { category })}
            />
          );
        },
      },
      {
        accessorKey: "price",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Price <ArrowUpDown className="size-3.5" />
          </button>
        ),
        size: 160,
        minSize: 120,
        cell: ({ row }) => {
          const vendor = row.original;
          return (
            <EditableNumber
              value={vendor.price}
              onSave={(price) => updateVendor(vendor.id, { price })}
              formatDisplay={formatIDR}
            />
          );
        },
      },
      {
        accessorKey: "contractStatus",
        header: ({ column }) => (
          <button
            className="flex items-center gap-1"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status <ArrowUpDown className="size-3.5" />
          </button>
        ),
        size: 140,
        minSize: 120,
        cell: ({ row }) => {
          const vendor = row.original;
          return (
            <VendorContractPill
              value={vendor.contractStatus}
              onChange={(contractStatus) => updateVendor(vendor.id, { contractStatus })}
            />
          );
        },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        enableSorting: false,
        size: 240,
        minSize: 120,
        cell: ({ row }) => {
          const vendor = row.original;
          return (
            <VenueNotesCell
              value={vendor.notes}
              onSave={(notes) => updateVendor(vendor.id, { notes })}
            />
          );
        },
      },
      {
        id: "files",
        header: "Files",
        enableSorting: false,
        size: 200,
        minSize: 140,
        cell: ({ row }) => <VendorFilesCell vendor={row.original} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableResizing: false,
        size: 120,
        cell: ({ row }) => {
          const vendor = row.original;
          const alreadyLinked = linkedVendorIds.has(vendor.id);
          const isConfirmed =
            vendor.contractStatus === "Chosen" || vendor.contractStatus === "Done";
          return (
            <div className="flex items-center gap-1.5">
              {isConfirmed && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={alreadyLinked}
                        className={alreadyLinked ? "text-emerald-600" : "text-muted-foreground"}
                        onClick={() => createBudgetItemFromVendor(vendor)}
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
                resourceType="image"
                onUpload={(url) => addVendorImage(vendor, url)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => deleteVendor(vendor.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [linkedVendorIds],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnSizing },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Vendors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Caterers, florists, photographers and everyone else making the day happen.
          </p>
        </div>
        <Button
          onClick={() =>
            createVendor(activeCategory === "All" ? undefined : activeCategory)
          }
          className="gap-1.5 self-start sm:self-auto"
        >
          <Plus className="size-4" />
          Add vendor
        </Button>
      </div>

      <VendorCategoryTabs active={activeCategory} onChange={setActiveCategory} counts={counts} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, contact or notes…"
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant={starredOnly ? "default" : "outline"}
          size="sm"
          className="gap-1.5 self-start sm:self-auto"
          onClick={() => setStarredOnly((v) => !v)}
        >
          <Star className={cn("size-4", starredOnly && "fill-current")} />
          Starred only
        </Button>
      </div>

      <Card className="overflow-hidden border-border/70 p-0 shadow-sm">
        <div className="overflow-x-auto">
          <Table style={{ width: table.getTotalSize(), tableLayout: "fixed" }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="relative overflow-hidden text-xs font-semibold uppercase tracking-wide text-ellipsis whitespace-nowrap text-muted-foreground"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onDoubleClick={() => header.column.resetSize()}
                          className={cn(
                            "absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary/40",
                            header.column.getIsResizing() && "bg-primary",
                          )}
                        />
                      )}
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
                    No vendors match your filters yet.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "transition-colors hover:bg-accent/30",
                      row.original.starred &&
                        "outline outline-2 -outline-offset-2 outline-yellow-300",
                      row.original.contractStatus === "Rejected" && "bg-pink-50",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className="align-top break-words whitespace-normal overflow-hidden"
                      >
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
