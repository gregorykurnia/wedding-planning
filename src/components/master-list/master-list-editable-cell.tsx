"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MasterListEditableCellProps {
  value: string;
  label: string;
  placeholder: string;
  className?: string;
  autoFocus?: boolean;
  onAutoFocusHandled?: () => void;
  onSave: (value: string) => Promise<void> | void;
}

/**
 * A small in-place editor for the Master List. It keeps a failed draft open
 * so a transient Firestore error never discards text the user already typed.
 */
export function MasterListEditableCell({
  value,
  label,
  placeholder,
  className,
  autoFocus = false,
  onAutoFocusHandled,
  onSave,
}: MasterListEditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayRef = useRef<HTMLButtonElement>(null);
  const autoFocusHandledRef = useRef(false);

  useLayoutEffect(() => {
    if (autoFocus && !autoFocusHandledRef.current) {
      autoFocusHandledRef.current = true;
      setDraft(value);
      setEditing(true);
      onAutoFocusHandled?.();
    }
  }, [autoFocus, onAutoFocusHandled, value]);

  useLayoutEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const cancel = () => {
    if (saving) return;
    setDraft(value);
    setError(null);
    setEditing(false);
    requestAnimationFrame(() => displayRef.current?.focus());
  };

  const commit = async () => {
    if (saving) return;
    if (draft === value) {
      setError(null);
      setEditing(false);
      requestAnimationFrame(() => displayRef.current?.focus());
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
      requestAnimationFrame(() => displayRef.current?.focus());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Unable to save ${label.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    const errorId = `master-list-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-error`;

    return (
      <div className="min-w-0">
        <Input
          ref={inputRef}
          value={draft}
          aria-label={`Edit ${label}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          placeholder={placeholder}
          disabled={saving}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          className={cn("h-8 bg-background shadow-sm", className)}
        />
        {error && (
          <div className="mt-1 flex items-center gap-2 text-[11px] text-destructive" role="alert">
            <span id={errorId} className="min-w-0 break-words">
              {error}
            </span>
            <button
              type="button"
              className="shrink-0 font-medium underline underline-offset-2 hover:no-underline"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void commit()}
              disabled={saving}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      ref={displayRef}
      type="button"
      data-master-list-editable="true"
      aria-label={`Edit ${label}${value ? `: ${value}` : ""}`}
      title={`Edit ${label}`}
      onMouseDown={(event) => {
        event.preventDefault();
        setDraft(value);
        setError(null);
        setEditing(true);
      }}
      className={cn(
        "w-full rounded-md px-2 py-1.5 text-left text-sm leading-5 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60",
        !value && "text-muted-foreground italic",
        className,
      )}
    >
      {value || placeholder}
    </button>
  );
}
