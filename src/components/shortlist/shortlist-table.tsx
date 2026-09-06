"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
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
import { EditableText } from "@/components/shared/editable-text";
import { ContactCell } from "@/components/shared/contact-cell";
import { VenueNotesCell } from "@/components/venues/venue-notes-cell";
import { VendorCategoryPill } from "@/components/vendors/vendor-category-pill";
import { VendorCategoryTabs } from "@/components/vendors/vendor-category-tabs";
import { ShortlistPriceCell } from "@/components/shortlist/shortlist-price-cell";
import {
  addShortlistSubEntry,
  createShortlistItem,
  deleteShortlistItem,
  removeShortlistSubEntry,
  updateShortlistItem,
  updateShortlistSubEntry,
  useShortlistItems,
} from "@/lib/collections/shortlist";
import { cn } from "@/lib/utils";
import type { ShortlistItem, ShortlistSubEntry, VendorCategory } from "@/lib/types";

const HEADERS = [
  { label: "Name", className: "min-w-[200px]" },
  { label: "Type", className: "min-w-[150px]" },
  { label: "Contact", className: "min-w-[170px]" },
  { label: "Price", className: "min-w-[200px] max-w-[220px]" },
  { label: "Bridestory Reviewers", className: "min-w-[110px]" },
  { label: "IG Followers", className: "min-w-[110px]" },
  { label: "Next Actions", className: "min-w-[160px]" },
  { label: "Notes", className: "min-w-[200px]" },
  { label: "", className: "w-[90px]" },
];

function NumberCell({
  value,
  onSave,
  placeholder,
}: {
  value: number | null;
  onSave: (value: number | null) => void;
  placeholder: string;
}) {
  return (
    <EditableText
      value={value != null ? String(value) : ""}
      onSave={(v) => {
        const parsed = v.trim() === "" ? null : Number(v);
        onSave(parsed === null || Number.isNaN(parsed) ? null : Math.round(parsed));
      }}
      placeholder={placeholder}
      className="px-1 text-sm"
    />
  );
}

function SubEntryRow({
  parent,
  sub,
}: {
  parent: ShortlistItem;
  sub: ShortlistSubEntry;
}) {
  const save = (data: Partial<Omit<ShortlistSubEntry, "id">>) =>
    updateShortlistSubEntry(parent, sub.id, data);

  return (
    <TableRow className="bg-muted/60 hover:bg-muted/70">
      <TableCell className="relative align-top pl-8 break-words whitespace-normal overflow-hidden before:absolute before:top-0 before:bottom-0 before:left-4 before:w-px before:bg-border">
        <EditableText
          value={sub.name}
          onSave={(name) => save({ name })}
          placeholder="Package name"
          className="text-sm"
        />
      </TableCell>
      <TableCell className="align-top break-words whitespace-normal overflow-hidden">
        <VendorCategoryPill value={sub.type} onChange={(type) => save({ type })} />
      </TableCell>
      <TableCell className="align-top text-xs text-muted-foreground italic break-words whitespace-normal overflow-hidden">
        Package
      </TableCell>
      <TableCell className="align-top break-words whitespace-normal overflow-hidden">
        <ShortlistPriceCell
          price={sub.price}
          description={sub.priceDescription}
          onSavePrice={(price) => save({ price })}
          onSaveDescription={(priceDescription) => save({ priceDescription })}
        />
      </TableCell>
      <TableCell className="align-top break-words whitespace-normal overflow-hidden">
        <NumberCell
          value={sub.bridestoryReviewers}
          onSave={(bridestoryReviewers) => save({ bridestoryReviewers })}
          placeholder="Add count"
        />
      </TableCell>
      <TableCell className="align-top break-words whitespace-normal overflow-hidden">
        <NumberCell
          value={sub.igFollowers}
          onSave={(igFollowers) => save({ igFollowers })}
          placeholder="Add count"
        />
      </TableCell>
      <TableCell className="align-top break-words whitespace-normal overflow-hidden">
        <EditableText
          value={sub.nextAction}
          onSave={(nextAction) => save({ nextAction })}
          multiline
          placeholder="Add next action"
          className="text-sm"
        />
      </TableCell>
      <TableCell className="align-top break-words whitespace-normal overflow-hidden">
        <VenueNotesCell value={sub.notes} onSave={(notes) => save({ notes })} />
      </TableCell>
      <TableCell className="align-top break-words whitespace-normal overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => removeShortlistSubEntry(parent, sub.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ShortlistRow({ item }: { item: ShortlistItem }) {
  const [expanded, setExpanded] = useState(true);
  const save = (data: Partial<ShortlistItem>) => updateShortlistItem(item.id, data);

  return (
    <>
      <TableRow className="hover:bg-accent/30">
        <TableCell className="align-top break-words whitespace-normal overflow-hidden">
          <div className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1.5 shrink-0 text-muted-foreground hover:text-foreground"
              title={expanded ? "Hide packages" : "Show packages"}
            >
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <EditableText
                value={item.name}
                onSave={(name) => save({ name })}
                placeholder="Vendor / venue name"
                className="font-medium text-foreground"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Add package"
              className="mt-0.5 size-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setExpanded(true);
                addShortlistSubEntry(item);
              }}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </TableCell>
        <TableCell className="align-top break-words whitespace-normal overflow-hidden">
          <VendorCategoryPill value={item.type} onChange={(type) => save({ type })} />
        </TableCell>
        <TableCell className="align-top break-words whitespace-normal overflow-hidden">
          <ContactCell
            name={item.contactName}
            phone={item.contactPhone}
            onSaveName={(contactName) => save({ contactName })}
            onSavePhone={(contactPhone) => save({ contactPhone })}
          />
        </TableCell>
        <TableCell className="align-top break-words whitespace-normal overflow-hidden">
          <ShortlistPriceCell
            price={item.price}
            description={item.priceDescription}
            onSavePrice={(price) => save({ price })}
            onSaveDescription={(priceDescription) => save({ priceDescription })}
          />
        </TableCell>
        <TableCell className="align-top break-words whitespace-normal overflow-hidden">
          <NumberCell
            value={item.bridestoryReviewers}
            onSave={(bridestoryReviewers) => save({ bridestoryReviewers })}
            placeholder="Add count"
          />
        </TableCell>
        <TableCell className="align-top break-words whitespace-normal overflow-hidden">
          <NumberCell
            value={item.igFollowers}
            onSave={(igFollowers) => save({ igFollowers })}
            placeholder="Add count"
          />
        </TableCell>
        <TableCell className="align-top break-words whitespace-normal overflow-hidden">
          <EditableText
            value={item.nextAction}
            onSave={(nextAction) => save({ nextAction })}
            multiline
            placeholder="Add next action"
            className="text-sm"
          />
        </TableCell>
        <TableCell className="align-top break-words whitespace-normal overflow-hidden">
          <VenueNotesCell value={item.notes} onSave={(notes) => save({ notes })} />
        </TableCell>
        <TableCell className="align-top break-words whitespace-normal overflow-hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => deleteShortlistItem(item.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </TableCell>
      </TableRow>
      {expanded &&
        item.subEntries.map((sub) => <SubEntryRow key={sub.id} parent={item} sub={sub} />)}
    </>
  );
}

export function ShortlistTable() {
  const { data: items, loading } = useShortlistItems();
  const [activeType, setActiveType] = useState<VendorCategory | "All">("All");
  const [typeSort, setTypeSort] = useState<"asc" | "desc" | null>(null);

  const counts = useMemo(() => {
    const result: Record<string, number> = { All: items.length };
    for (const item of items) {
      result[item.type] = (result[item.type] ?? 0) + 1;
    }
    return result;
  }, [items]);

  const filtered = useMemo(() => {
    const base = activeType === "All" ? items : items.filter((item) => item.type === activeType);
    if (!typeSort) return base;
    const sorted = [...base].sort((a, b) => a.type.localeCompare(b.type));
    return typeSort === "asc" ? sorted : sorted.reverse();
  }, [items, activeType, typeSort]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Shortlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Options you&apos;re still weighing — use the + next to a name to add its packages
            (e.g. Gold / Silver / Bronze from the same vendor).
          </p>
        </div>
        <Button
          onClick={() => createShortlistItem(activeType === "All" ? undefined : activeType)}
          className="gap-1.5 self-start sm:self-auto"
        >
          <Plus className="size-4" />
          Add to shortlist
        </Button>
      </div>

      <VendorCategoryTabs active={activeType} onChange={setActiveType} counts={counts} />

      <Card className="overflow-hidden border-border/70 p-0 shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {HEADERS.map((h) => (
                  <TableHead
                    key={h.label}
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                      h.className,
                    )}
                  >
                    {h.label === "Type" ? (
                      <button
                        type="button"
                        className="flex items-center gap-1"
                        onClick={() =>
                          setTypeSort((prev) =>
                            prev === "asc" ? "desc" : prev === "desc" ? null : "asc",
                          )
                        }
                      >
                        Type <ArrowUpDown className="size-3.5" />
                      </button>
                    ) : (
                      h.label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {HEADERS.map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={HEADERS.length} className="py-10 text-center text-muted-foreground">
                    No shortlist entries match this filter.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => <ShortlistRow key={item.id} item={item} />)
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Button
        variant="outline"
        onClick={() => createShortlistItem(activeType === "All" ? undefined : activeType)}
        className="gap-1.5 self-start"
      >
        <Plus className="size-4" />
        Add to shortlist
      </Button>
    </div>
  );
}
