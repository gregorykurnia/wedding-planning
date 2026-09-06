"use client";

import { EditableNumber } from "@/components/shared/editable-number";
import { EditableText } from "@/components/shared/editable-text";
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
    <div className="flex flex-col gap-1">
      <EditableNumber value={price} onSave={onSavePrice} formatDisplay={formatIDR} className="font-medium" />
      <EditableText
        value={description}
        onSave={onSaveDescription}
        multiline
        placeholder="What's included at this price…"
        className="px-1 text-xs text-muted-foreground"
      />
    </div>
  );
}
