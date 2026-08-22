"use client";

import { useState } from "react";
import { EditableText } from "@/components/shared/editable-text";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface VenueNotesCellProps {
  value: string;
  onSave: (value: string) => void;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        // split() with a capturing group puts matches at odd indices
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// Notes longer than this read like a mini-doc (e.g. a vendor's full
// talent/option list) and get a dedicated dialog instead of inline editing.
const DOC_THRESHOLD = 200;

function NotesDialogCell({ value, onSave }: VenueNotesCellProps) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setEditing(false);
          setDraft(value);
        }
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/60"
          />
        }
      >
        {value.slice(0, 60)}… <span className="text-primary">View full note</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notes</DialogTitle>
        </DialogHeader>
        {editing ? (
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="max-h-[60vh] min-h-64 resize-none text-sm"
          />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm">
            <Linkified text={value} />
          </div>
        )}
        <DialogFooter>
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onSave(draft);
                  setEditing(false);
                }}
              >
                Save
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VenueNotesCell({ value, onSave }: VenueNotesCellProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = value.length > 60;

  if (value.length > DOC_THRESHOLD) {
    return <NotesDialogCell value={value} onSave={onSave} />;
  }

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
