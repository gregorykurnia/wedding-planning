"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface EditableDateProps {
  value: string | null;
  onSave: (value: string | null) => void;
  className?: string;
}

/**
 * A native date input buffered through local state so it only writes on
 * blur — a fully controlled date input re-renders on every keystroke
 * (including the empty value native inputs report mid-typing), which
 * wipes out whatever the user had already typed into the other segments.
 */
export function EditableDate({ value, onSave, className }: EditableDateProps) {
  const [draft, setDraft] = useState(value ?? "");
  const [prevValue, setPrevValue] = useState(value);

  // Resync from an external change (e.g. another client editing this row)
  // without clobbering in-progress typing — done during render, per React's
  // "adjusting state when a prop changes" pattern, rather than an effect.
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value ?? "");
  }

  return (
    <Input
      type="date"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== (value ?? "")) onSave(draft || null);
      }}
      className={cn(
        "h-8 w-36 border-none bg-transparent text-xs text-muted-foreground shadow-none",
        className,
      )}
    />
  );
}
