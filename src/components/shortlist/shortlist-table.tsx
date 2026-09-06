"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
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
import type { ShortlistItem, ShortlistSubEntry } from "@/lib/types";

const HEADERS = [
  { label: "Name", className: "min-w-[200px]" },
  { label: "Type", className: "min-w-[150px]" },
  { label: "Contact", className: "min-w-[170px]" },
  { label: "Price", className: "min-w-[200px]" },
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
      <TableCell className="relative align-top pl-8 before:absolute before:top-0 before:bottom-0 before:left-4 before:w-px before:bg-border">
        <EditableText
          value={sub.name}
          onSave={(name) => save({ name })}
          placeholder="Option name"
          className="text-sm"
        />
      </TableCell>
      <TableCell className="align-top">
        <VendorCategoryPill value={sub.type} onChange={(type) => save({ type })} />
      </TableCell>
      <TableCell className="align-top text-xs text-muted-foreground italic">
        Comparison option
      </TableCell>
      <TableCell className="align-top">
        <ShortlistPriceCell
          price={sub.price}
          description={sub.priceDescription}
          onSavePrice={(price) => save({ price })}
          onSaveDescription={(priceDescription) => save({ priceDescription })}
        />
      </TableCell>
      <TableCell className="align-top">
        <NumberCell
          value={sub.bridestoryReviewers}
          onSave={(bridestoryReviewers) => save({ bridestoryReviewers })}
          placeholder="Add count"
        />
      </TableCell>
      <TableCell className="align-top">
        <NumberCell
          value={sub.igFollowers}
          onSave={(igFollowers) => save({ igFollowers })}
          placeholder="Add count"
        />
      </TableCell>
      <TableCell className="align-top">
        <EditableText
          value={sub.nextAction}
          onSave={(nextAction) => save({ nextAction })}
          multiline
          placeholder="Add next action"
          className="text-sm"
        />
      </TableCell>
      <TableCell className="align-top">
        <VenueNotesCell value={sub.notes} onSave={(notes) => save({ notes })} />
      </TableCell>
      <TableCell className="align-top">
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
        <TableCell className="align-top">
          <div className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1.5 shrink-0 text-muted-foreground hover:text-foreground"
              title={expanded ? "Hide comparison options" : "Show comparison options"}
            >
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
            <EditableText
              value={item.name}
              onSave={(name) => save({ name })}
              placeholder="Vendor / venue name"
              className="font-medium text-foreground"
            />
          </div>
        </TableCell>
        <TableCell className="align-top">
          <VendorCategoryPill value={item.type} onChange={(type) => save({ type })} />
        </TableCell>
        <TableCell className="align-top">
          <ContactCell
            name={item.contactName}
            phone={item.contactPhone}
            onSaveName={(contactName) => save({ contactName })}
            onSavePhone={(contactPhone) => save({ contactPhone })}
          />
        </TableCell>
        <TableCell className="align-top">
          <ShortlistPriceCell
            price={item.price}
            description={item.priceDescription}
            onSavePrice={(price) => save({ price })}
            onSaveDescription={(priceDescription) => save({ priceDescription })}
          />
        </TableCell>
        <TableCell className="align-top">
          <NumberCell
            value={item.bridestoryReviewers}
            onSave={(bridestoryReviewers) => save({ bridestoryReviewers })}
            placeholder="Add count"
          />
        </TableCell>
        <TableCell className="align-top">
          <NumberCell
            value={item.igFollowers}
            onSave={(igFollowers) => save({ igFollowers })}
            placeholder="Add count"
          />
        </TableCell>
        <TableCell className="align-top">
          <EditableText
            value={item.nextAction}
            onSave={(nextAction) => save({ nextAction })}
            multiline
            placeholder="Add next action"
            className="text-sm"
          />
        </TableCell>
        <TableCell className="align-top">
          <VenueNotesCell value={item.notes} onSave={(notes) => save({ notes })} />
        </TableCell>
        <TableCell className="align-top">
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
      {expanded && (
        <>
          {item.subEntries.map((sub) => (
            <SubEntryRow key={sub.id} parent={item} sub={sub} />
          ))}
          <TableRow className="bg-muted/60 hover:bg-muted/70">
            <TableCell colSpan={HEADERS.length} className="pl-8 py-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => addShortlistSubEntry(item)}
              >
                <Copy className="size-3" />
                Add comparison option
              </Button>
            </TableCell>
          </TableRow>
        </>
      )}
    </>
  );
}

export function ShortlistTable() {
  const { data: items, loading } = useShortlistItems();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Shortlist</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Options you&apos;re still weighing — use the copy icon to add comparison options
            under an entry (e.g. different packages from the same vendor).
          </p>
        </div>
        <Button onClick={() => createShortlistItem()} className="gap-1.5 self-start sm:self-auto">
          <Plus className="size-4" />
          Add to shortlist
        </Button>
      </div>

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
                    {h.label}
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
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={HEADERS.length} className="py-10 text-center text-muted-foreground">
                    No shortlist entries yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => <ShortlistRow key={item.id} item={item} />)
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Button variant="outline" onClick={() => createShortlistItem()} className="gap-1.5 self-start">
        <Plus className="size-4" />
        Add to shortlist
      </Button>
    </div>
  );
}
