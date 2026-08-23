"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createNote, deleteNote, updateNote, useNotes } from "@/lib/collections/notes";
import { useWorkspace } from "@/lib/workspace-context";

export default function NotesPage() {
  const { workspace } = useWorkspace();
  const { data: notes, loading } = useNotes(workspace?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...notes].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const handleCreate = () => {
    if (!workspace) return;
    setError(null);
    createNote(workspace.id).catch((err) => {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to add note");
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Random thoughts, ideas, and reminders — jot them down here.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button onClick={handleCreate} className="gap-1.5">
            <Plus className="size-4" />
            Add note
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <Card className="border-dashed border-border/70 shadow-none">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No notes yet. Add one to jot down a quick thought.
            </p>
            <Button variant="outline" size="sm" onClick={handleCreate} className="gap-1.5">
              <Plus className="size-3.5" />
              Add note
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((note) => (
            <Card key={note.id} className="group border-border/70 shadow-sm">
              <CardContent className="flex flex-col gap-2 pt-4">
                <Textarea
                  defaultValue={note.text}
                  placeholder="Type a note..."
                  onBlur={(e) => {
                    if (workspace && e.target.value !== note.text) {
                      updateNote(workspace.id, note.id, { text: e.target.value });
                    }
                  }}
                  className="min-h-28 resize-none border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
                <div className="flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    onClick={() => workspace && deleteNote(workspace.id, note.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
