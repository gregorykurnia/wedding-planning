"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface EditableNumberProps {
  value: number;
  onSave: (value: number) => void;
  formatDisplay: (value: number) => string;
  className?: string;
}

export function EditableNumber({
  value,
  onSave,
  formatDisplay,
  className,
}: EditableNumberProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft.replace(/[^0-9.-]/g, ""));
    const next = Number.isFinite(parsed) ? parsed : value;
    if (next !== value) onSave(next);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className={cn("h-8 border-primary/40 bg-background text-sm shadow-sm", className)}
      />
    );
  }

  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // See editable-text.tsx: entering edit mode on mousedown (not
        // click) lets React batch this with a blur-triggered commit
        // elsewhere in the same tick, so one click reliably focuses this
        // cell instead of needing a second click.
        e.preventDefault();
        setDraft(String(value));
        setEditing(true);
      }}
      className={cn(
        "w-full rounded-md px-2 py-1.5 text-left text-sm tabular-nums transition-colors hover:bg-accent/60",
        className,
      )}
    >
      {formatDisplay(value)}
    </button>
  );
}
