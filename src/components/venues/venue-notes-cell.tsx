"use client";

import { useState } from "react";
import { EditableText } from "@/components/shared/editable-text";

interface VenueNotesCellProps {
  value: string;
  onSave: (value: string) => void;
}

export function VenueNotesCell({ value, onSave }: VenueNotesCellProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = value.length > 60;

  if (expanded) {
    return (
      <div className="min-w-[220px]">
        <EditableText value={value} onSave={onSave} multiline className="min-h-16" />
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-1 text-xs text-primary hover:underline"
        >
          Collapse
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-[180px] max-w-[240px]">
      <EditableText
        value={value}
        onSave={onSave}
        displayFormatter={(v) => (isLong ? `${v.slice(0, 60)}…` : v)}
      />
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-0.5 text-xs text-primary hover:underline"
        >
          Expand
        </button>
      )}
    </div>
  );
}
