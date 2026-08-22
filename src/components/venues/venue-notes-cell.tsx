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

  return (
    <div className="min-w-0 max-w-full">
      <EditableText
        value={value}
        onSave={onSave}
        multiline
        className={expanded ? "min-h-16" : undefined}
        displayFormatter={(v) => (isLong && !expanded ? `${v.slice(0, 60)}…` : v)}
      />
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-0.5 text-xs text-primary hover:underline"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      )}
    </div>
  );
}
