"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { TableKit } from "@tiptap/extension-table";
import type { JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
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
import { evaluateTableFormulas, updateFormulaDisplays } from "@/components/notes/formulas";
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

type SortDirection = "asc" | "desc";

function findTableAt(doc: PMNode, position: number) {
  const resolved = doc.resolve(position);
  for (let depth = resolved.depth; depth >= 0; depth -= 1) {
    const node = resolved.node(depth);
    if (node.type.name === "table") {
      return { node, position: depth === 0 ? 0 : resolved.before(depth) };
    }
  }
  return null;
}

function sortTableColumn(editor: NonNullable<ReturnType<typeof useEditor>>, position: number, columnIndex: number, direction: SortDirection) {
  const tableContext = findTableAt(editor.state.doc, position);
  if (!tableContext) return;

  const rows = Array.from({ length: tableContext.node.childCount }, (_, index) => tableContext.node.child(index));
  const hasHeader = rows[0]?.childCount > 0 && rows[0].child(0).type.name === "tableHeader";
  const headerOffset = hasHeader ? 1 : 0;
  const sortableRows = rows.slice(headerOffset);
  const evaluation = evaluateTableFormulas(tableContext.node);
  const values = sortableRows.map((row, index) => {
    const result = evaluation.getCell(index + headerOffset, columnIndex);
    return {
      text: row.child(columnIndex)?.textContent.trim() ?? "",
      numeric: result.error ? null : result.value,
    };
  });
  const nonEmptyValues = values.filter(({ text }) => text);
  const isNumericColumn = nonEmptyValues.length > 0 && nonEmptyValues.every(({ numeric }) => numeric !== null);

  const sortedRows = sortableRows
    .map((row, index) => ({ row, ...values[index] }))
    .sort((a, b) => {
      if (!a.text && !b.text) return 0;
      if (!a.text) return 1;
      if (!b.text) return -1;

      const comparison = isNumericColumn
        ? (a.numeric ?? 0) - (b.numeric ?? 0)
        : a.text.localeCompare(b.text, undefined, { numeric: true, sensitivity: "base" });
      return direction === "asc" ? comparison : -comparison;
    })
    .map(({ row }) => row);

  const nextRows = hasHeader ? [rows[0], ...sortedRows] : sortedRows;
  const nextTable = tableContext.node.type.create(tableContext.node.attrs, nextRows, tableContext.node.marks);
  editor.view.dispatch(editor.state.tr.replaceWith(tableContext.position, tableContext.position + tableContext.node.nodeSize, nextTable));
}

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
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInTable, setIsInTable] = useState(false);
  const latestDraft = useRef({ title: note.title, content: note.content });
  const [initialContent] = useState<JSONContent>(() => note.content);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortDirections = useRef(new Map<string, SortDirection>());
  const extensions = useMemo(
    () => [
      StarterKit,
      TextStyleKit,
      TableKit.configure({
        table: {
          resizable: true,
          renderWrapper: true,
        },
      }),
    ],
    [],
  );

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
    extensions,
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      const nextContent = nextEditor.getJSON();
      updateFormulaDisplays(nextEditor);
      markDraftChanged({ title: latestDraft.current.title, content: nextContent });
    },
    onSelectionUpdate: ({ editor: nextEditor }) => setIsInTable(nextEditor.isActive("table")),
    onTransaction: ({ editor: nextEditor }) => setIsInTable(nextEditor.isActive("table")),
  });

  useEffect(() => {
    if (!editor) return;
    updateFormulaDisplays(editor);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const handleHeaderClick = (event: MouseEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const header = event.target.closest("th");
      if (!header || !editor.view.dom.contains(header)) return;

      const headerBounds = header.getBoundingClientRect();
      if (event.clientX < headerBounds.right - 28) return;

      const row = header.parentElement;
      if (!row) return;
      const columnIndex = Array.from(row.children).indexOf(header);
      if (columnIndex < 0) return;

      try {
        const position = editor.view.posAtDOM(header, 0);
        const tableContext = findTableAt(editor.state.doc, position);
        if (!tableContext) return;
        const key = `${tableContext.position}:${columnIndex}`;
        const direction = sortDirections.current.get(key) === "asc" ? "desc" : "asc";
        sortDirections.current.set(key, direction);
        sortTableColumn(editor, position, columnIndex, direction);

        const nextHeaders = header.closest("table")?.querySelectorAll("th");
        nextHeaders?.forEach((nextHeader, index) => {
          if (index === columnIndex) nextHeader.setAttribute("data-sort-direction", direction);
          else nextHeader.removeAttribute("data-sort-direction");
        });
      } catch {
        // Ignore clicks on a header that has just been removed or remounted.
      }
    };

    editor.view.dom.addEventListener("click", handleHeaderClick);
    return () => editor.view.dom.removeEventListener("click", handleHeaderClick);
  }, [editor]);

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
    <section className="flex min-h-[32rem] flex-col rounded-2xl border border-border/70 bg-card shadow-sm">
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

      <div className="sticky top-[3.75rem] z-30 flex flex-wrap items-center gap-1 border-b border-border/70 bg-card/95 p-2 backdrop-blur">
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

        <div className="mx-1 h-5 w-px bg-border" />

        <select
          aria-label="Insert table"
          defaultValue=""
          className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          onChange={(event) => {
            const [rows, cols] = event.target.value.split("x").map(Number);
            if (rows && cols) editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
            event.target.value = "";
          }}
        >
          <option value="">Insert table</option>
          <option value="2x2">2 × 2 table</option>
          <option value="3x3">3 × 3 table</option>
          <option value="4x3">4 × 3 table</option>
          <option value="5x4">5 × 4 table</option>
          <option value="6x5">6 × 5 table</option>
        </select>

        <select
          aria-label="Table actions"
          defaultValue=""
          disabled={!isInTable}
          className="h-7 max-w-40 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
          onChange={(event) => {
            const action = event.target.value;
            const chain = editor.chain().focus();
            if (action === "add-row") chain.addRowAfter().run();
            if (action === "add-rows") {
              const requested = window.prompt("How many rows would you like to add?", "5");
              const count = requested ? Number.parseInt(requested, 10) : 0;
              if (Number.isInteger(count) && count > 0 && count <= 50) {
                const bulkChain = editor.chain().focus();
                for (let index = 0; index < count; index += 1) bulkChain.addRowAfter();
                bulkChain.run();
              }
            }
            if (action === "add-column") chain.addColumnAfter().run();
            if (action === "delete-row") chain.deleteRow().run();
            if (action === "delete-column") chain.deleteColumn().run();
            if (action === "header-row") chain.toggleHeaderRow().run();
            if (action === "delete-table") chain.deleteTable().run();
            event.target.value = "";
          }}
        >
          <option value="">Table actions</option>
          <option value="add-row">Add row below</option>
          <option value="add-rows">Add multiple rows…</option>
          <option value="add-column">Add column right</option>
          <option value="delete-row">Delete current row</option>
          <option value="delete-column">Delete current column</option>
          <option value="header-row">Toggle header row</option>
          <option value="delete-table">Delete table</option>
        </select>

        {isInTable && <span className="ml-1 hidden text-[11px] text-muted-foreground lg:inline">Formula example: =SUM(B2:B)</span>}

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

      <EditorContent editor={editor} className="flex-1 px-5 py-5 sm:px-8 sm:py-7" />
    </section>
  );
}
