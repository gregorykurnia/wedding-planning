"use client";

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  displayFormatter?: (value: string) => React.ReactNode;
}

/**
 * Click-to-edit text field: renders as plain text until clicked, then
 * becomes an input/textarea that saves on blur or Enter (Escape cancels).
 */
export function EditableText({
  value,
  onSave,
  placeholder = "—",
  className,
  multiline = false,
  displayFormatter,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    return (
      <Textarea
        ref={inputRef}
        value={draft}
        rows={multiline ? 3 : 1}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !multiline) {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={cn(
          "min-h-0 resize-none border-primary/40 bg-background py-1.5 text-sm shadow-sm focus-visible:ring-primary/40",
          !multiline && "h-8",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={cn(
        "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/60",
        !value && "text-muted-foreground italic",
        className,
      )}
    >
      {value ? (displayFormatter ? displayFormatter(value) : value) : placeholder}
    </button>
  );
}
