"use client";

import { EditableNumber } from "@/components/shared/editable-number";
import { VenueNotesCell } from "@/components/venues/venue-notes-cell";
import { formatIDR } from "@/lib/format";

interface ShortlistPriceCellProps {
  price: number;
  description: string;
  onSavePrice: (price: number) => void;
  onSaveDescription: (description: string) => void;
}

export function ShortlistPriceCell({
  price,
  description,
  onSavePrice,
  onSaveDescription,
}: ShortlistPriceCellProps) {
  return (
    <div className="flex min-w-0 max-w-[220px] flex-col gap-1">
      <EditableNumber value={price} onSave={onSavePrice} formatDisplay={formatIDR} className="font-medium" />
      <VenueNotesCell
        value={description}
        onSave={onSaveDescription}
        placeholder="What's included at this price…"
        dialogTitle="What's included at this price"
      />
    </div>
  );
}
