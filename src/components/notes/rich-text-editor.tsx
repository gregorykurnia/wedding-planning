"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import type { JSONContent } from "@tiptap/core";
import {
  Bold,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Minus,
  Palette,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Note } from "@/lib/types";

type SaveState = "saved" | "unsaved" | "saving" | "error";

interface RichTextEditorProps {
  note: Note;
  onSave: (data: { title: string; content: JSONContent }) => Promise<unknown>;
}

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Inter", value: "Inter" },
  { label: "Georgia", value: "Georgia" },
  { label: "Arial", value: "Arial" },
  { label: "Courier New", value: "Courier New" },
];

const FONT_SIZES = [
  { label: "Small", value: "14px" },
  { label: "Normal", value: "16px" },
  { label: "Large", value: "20px" },
  { label: "Extra large", value: "28px" },
];

function ToolbarButton({
  label,
  onClick,
  active = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({ note, onSave }: RichTextEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState<JSONContent>(note.content);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const latestDraft = useRef({ title: note.title, content: note.content });
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback(async () => {
    if (!dirty.current) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    dirty.current = false;
    setSaveState("saving");
    setErrorMessage(null);

    try {
      await onSave(latestDraft.current);
      setSaveState("saved");
    } catch (error) {
      dirty.current = true;
      setSaveState("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to save document");
    }
  }, [onSave]);

  const markDraftChanged = useCallback(
    (draft: { title: string; content: JSONContent }) => {
      latestDraft.current = draft;
      dirty.current = true;
      setSaveState("unsaved");
      setErrorMessage(null);

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveDraft();
      }, 800);
    },
    [saveDraft],
  );

  const editor = useEditor({
    extensions: [StarterKit, TextStyleKit],
    content: note.content,
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      const nextContent = nextEditor.getJSON();
      setContent(nextContent);
      markDraftChanged({ title: latestDraft.current.title, content: nextContent });
    },
  });

  useEffect(() => {
    latestDraft.current = { title, content };
  }, [content, title]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirty.current) void onSave(latestDraft.current);
    };
  }, [onSave]);

  if (!editor) {
    return <div className="min-h-[32rem] animate-pulse rounded-xl bg-muted/40" />;
  }

  const activeColor = editor.getAttributes("textStyle").color || "#2b2f4a";
  const activeBackground = editor.getAttributes("textStyle").backgroundColor || "#fff1b8";

  return (
    <section className="flex min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-1 border-b border-border/70 bg-muted/25 p-2">
        <select
          aria-label="Text style"
          className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          value={editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "paragraph"}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "paragraph") editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run();
          }}
        >
          <option value="paragraph">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        <select
          aria-label="Font family"
          className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          value={editor.getAttributes("textStyle").fontFamily || ""}
          onChange={(event) => {
            const value = event.target.value;
            if (value) editor.chain().focus().setFontFamily(value).run();
            else editor.chain().focus().unsetFontFamily().run();
          }}
        >
          {FONT_FAMILIES.map((font) => (
            <option key={font.label} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        <select
          aria-label="Font size"
          className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          value={editor.getAttributes("textStyle").fontSize || "16px"}
          onChange={(event) => editor.chain().focus().setFontSize(event.target.value).run()}
        >
          {FONT_SIZES.map((size) => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic />
        </ToolbarButton>
        <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Underline />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough />
        </ToolbarButton>
        <ToolbarButton label="Bulleted list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered />
        </ToolbarButton>

        <label className="relative flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Text color">
          <Palette className="size-4" />
          <input
            type="color"
            aria-label="Text color"
            value={activeColor}
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <label className="relative flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Highlight color">
          <Highlighter className="size-4" />
          <input
            type="color"
            aria-label="Highlight color"
            value={activeBackground}
            onChange={(event) => editor.chain().focus().setBackgroundColor(event.target.value).run()}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 />
        </ToolbarButton>
        <ToolbarButton label="Clear formatting" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
          <Minus />
        </ToolbarButton>

      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-4 sm:px-8">
        <Input
          value={title}
          onChange={(event) => {
            const nextTitle = event.target.value;
            setTitle(nextTitle);
            markDraftChanged({ title: nextTitle, content: latestDraft.current.content });
          }}
          placeholder="Document title"
          aria-label="Document title"
          className="h-auto min-w-0 flex-1 border-none bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 sm:text-3xl"
        />
        <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
          {saveState === "saving" && "Saving…"}
          {saveState === "unsaved" && "Unsaved changes"}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && (
            <button type="button" className="text-destructive underline underline-offset-2" onClick={() => void saveDraft()}>
              {errorMessage ?? "Retry save"}
            </button>
          )}
        </span>
      </div>

      <EditorContent editor={editor} className="flex-1 px-5 py-5 sm:px-8 sm:py-7" />
    </section>
  );
}
