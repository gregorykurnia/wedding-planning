"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextEditor } from "@/components/notes/rich-text-editor";
import { createNote, deleteNote, updateNote, useNotes } from "@/lib/collections/notes";
import type { Note } from "@/lib/types";

function getPreview(content: Note["content"]) {
  const text: string[] = [];

  function visit(node: Note["content"]) {
    if (node.type === "text" && node.text) text.push(node.text);
    node.content?.forEach(visit);
    if (node.type === "paragraph" || node.type === "heading") text.push(" ");
  }

  visit(content);
  return text.join("").replace(/\s+/g, " ").trim();
}

function formatUpdatedAt(note: Note) {
  const timestamp = note.updatedAt ?? note.createdAt;
  if (!timestamp) return "New document";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

function NoteListItem({ note, active, onSelect }: { note: Note; active: boolean; onSelect: () => void }) {
  const preview = getPreview(note.content);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
        active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-accent/60"
      }`}
    >
      <FileText className={`mt-0.5 size-4 shrink-0 ${active ? "text-primary-foreground/80" : "text-primary"}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{note.title}</span>
        <span className={`mt-0.5 block truncate text-xs ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {preview || "Empty document"}
        </span>
        <span className={`mt-1 block text-[11px] ${active ? "text-primary-foreground/60" : "text-muted-foreground/80"}`}>
          {formatUpdatedAt(note)}
        </span>
      </span>
    </button>
  );
}

export default function NotesPage() {
  const { data: notes, loading, error: notesError } = useNotes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)),
    [notes],
  );

  const filteredNotes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sortedNotes;
    return sortedNotes.filter((note) => note.title.toLowerCase().includes(term) || getPreview(note.content).toLowerCase().includes(term));
  }, [search, sortedNotes]);

  const activeSelectedId = selectedId && notes.some((note) => note.id === selectedId)
    ? selectedId
    : sortedNotes[0]?.id ?? null;
  const selectedNote = notes.find((note) => note.id === activeSelectedId) ?? null;

  const handleCreate = useCallback(async () => {
    setActionError(null);
    try {
      const created = await createNote();
      setSelectedId(created.id);
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : "Failed to add document");
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedNote) return;
    const confirmed = window.confirm(`Delete “${selectedNote.title}”? This cannot be undone.`);
    if (!confirmed) return;

    setActionError(null);
    try {
      await deleteNote(selectedNote.id);
      const nextNote = sortedNotes.find((note) => note.id !== selectedNote.id);
      setSelectedId(nextNote?.id ?? null);
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : "Failed to delete document");
    }
  }, [selectedNote, sortedNotes]);

  const selectedNoteId = selectedNote?.id;
  const saveSelectedNote = useCallback(
    (data: { title: string; content: Note["content"] }) => {
      if (!selectedNoteId) return Promise.resolve();
      // The initially displayed note is derived from the sorted list while
      // selectedId is still null. Lock its identity before Firestore applies
      // the pending server timestamp; otherwise the temporary timestamp can
      // reorder the list, mount a different editor, and reset page scroll.
      setSelectedId(selectedNoteId);
      return updateNote(selectedNoteId, data);
    },
    [selectedNoteId],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-foreground">Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep wedding ideas, decisions, and useful details together in documents.
          </p>
        </div>
        <Button onClick={() => void handleCreate()} className="gap-1.5">
          <Plus className="size-4" />
          New document
        </Button>
      </div>

      {(notesError || actionError) && (
        <p className="text-sm text-destructive">{notesError ?? actionError}</p>
      )}

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-[32rem] w-full rounded-2xl" />
        </div>
      ) : notes.length === 0 ? (
        <Card className="border-dashed border-border/70 shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText className="size-8 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">No documents yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create your first wedding planning document.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void handleCreate()} className="gap-1.5">
              <Plus className="size-3.5" />
              New document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="flex flex-col gap-3 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search documents"
                  aria-label="Search documents"
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents</span>
                <span className="text-xs text-muted-foreground">{notes.length}</span>
              </div>
              <div className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto">
                {filteredNotes.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">No matching documents.</p>
                ) : (
                  filteredNotes.map((note) => (
                    <NoteListItem key={note.id} note={note} active={note.id === activeSelectedId} onSelect={() => setSelectedId(note.id)} />
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {selectedNote && (
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <p className="text-xs text-muted-foreground">Document editor</p>
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => void handleDelete()}>
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
              <RichTextEditor
                key={selectedNote.id}
                note={selectedNote}
                onSave={saveSelectedNote}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
