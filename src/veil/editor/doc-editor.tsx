"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import type { DocumentDraft } from "@/lib/data/documents";
import { normaliseDoc, stableKey } from "@/lib/model/documents";
import { useSheets } from "@/veil/shell/sheet";
import { LinkBubble } from "./link-bubble";
import { LinkSheet, linkTargetOf } from "./link-sheet";
import { LINK_SHORTCUT_EVENT, docExtensions } from "./marks";
import { Paper } from "./paper";
import { TableBar } from "./table-bar";
import { EditorToolbar } from "./toolbar";
import content from "./content.module.css";

type DocEditorProps = {
  /** What the document held when it opened. Read once: the editor never remounts on a snapshot. */
  initial: DocumentDraft;
  /**
   * The document as the server has it now, from each confirmed snapshot. When
   * it changes and there's nothing unsaved here, it replaces what's on the
   * page (a partner's saved change, §9.2 Q7); with unsaved changes it's left,
   * and the next save wins.
   */
  incoming: DocumentDraft | null;
  hasUnsaved: () => boolean;
  editable: boolean;
  focusTitle: boolean;
  meta: string;
  onChange: (draft: DocumentDraft) => void;
  /** The save state, drawn at the end of the toolbar. */
  saveState: ReactNode;
  /** Between the toolbar and the page: "Bella is also in this document". */
  banner?: ReactNode;
  /**
   * The stored content holds something the editor can't read (P4-S14). The
   * editor opens empty and read-only from then on, so nothing typed can save
   * the empty page over what's stored.
   */
  onUnreadable: () => void;
};

/** The JSON the editor itself would make of `doc`, so a comparison isn't fooled by default attributes. */
function canonical(editor: Editor, doc: JSONContent): JSONContent | null {
  try {
    return editor.schema.nodeFromJSON(normaliseDoc(doc)).toJSON() as JSONContent;
  } catch {
    return null;
  }
}

const keyOf = (title: string, doc: JSONContent | null) => stableKey({ title, doc });

/**
 * A document being written (guide §4.24, §5.17): the toolbar, the table bar
 * while the cursor is in a table, the page with its title, and the body. Links open the link bubble when clicked; Cmd/Ctrl+K and
 * the toolbar's Link open the link sheet.
 */
export function DocEditor({
  initial,
  incoming,
  hasUnsaved,
  editable,
  focusTitle,
  meta,
  onChange,
  saveState,
  banner,
  onUnreadable,
}: DocEditorProps) {
  const sheets = useSheets();
  const [title, setTitle] = useState(initial.title);
  const [startContent] = useState(initial.content);
  const [bubble, setBubble] = useState<HTMLAnchorElement | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const unreadableRef = useRef(false);
  const titleRef = useRef(initial.title);
  const onChangeRef = useRef(onChange);
  const onUnreadableRef = useRef(onUnreadable);
  const editableRef = useRef(editable);
  useEffect(() => {
    onChangeRef.current = onChange;
    onUnreadableRef.current = onUnreadable;
    editableRef.current = editable && !unreadable;
  });
  const canEdit = editable && !unreadable;

  const [extensions] = useState(docExtensions);
  const editor = useEditor({
    extensions,
    content: startContent,
    editable,
    enableContentCheck: true,
    onContentError: () => {
      unreadableRef.current = true;
      setUnreadable(true);
      onUnreadableRef.current();
    },
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: content.ed,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Document",
        dir: "auto",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: e }) => {
      setBubble(null);
      if (unreadableRef.current) return;
      onChangeRef.current({ title: titleRef.current, content: e.getJSON() });
    },
  });

  useEffect(() => {
    if (editor && editor.isEditable !== canEdit) editor.setEditable(canEdit, false);
  }, [editor, canEdit]);

  // A change the server has that isn't from this page.
  const lastIncoming = useRef<string | null>(null);
  useEffect(() => {
    if (!editor || !incoming) return;
    const doc = canonical(editor, incoming.content);
    const key = keyOf(incoming.title, doc);
    if (lastIncoming.current === null) {
      // The first snapshot is what opened.
      lastIncoming.current = key;
      return;
    }
    if (key === lastIncoming.current) return;
    lastIncoming.current = key;
    if (!doc || hasUnsaved() || unreadableRef.current) return;
    if (key === keyOf(titleRef.current, editor.getJSON())) return;
    const { from, to } = editor.state.selection;
    editor.chain().setMeta("addToHistory", false).setContent(doc, { emitUpdate: false }).run();
    const end = editor.state.doc.content.size;
    if (editor.isFocused) editor.commands.setTextSelection({ from: Math.min(from, end), to: Math.min(to, end) });
    titleRef.current = incoming.title;
    setTitle(incoming.title);
  }, [editor, incoming, hasUnsaved]);

  const openLink = useCallback(() => {
    if (!editor || !editableRef.current) return;
    setBubble(null);
    sheets.open(<LinkSheet editor={editor} target={linkTargetOf(editor)} />);
  }, [editor, sheets]);
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    dom.addEventListener(LINK_SHORTCUT_EVENT, openLink);
    return () => dom.removeEventListener(LINK_SHORTCUT_EVENT, openLink);
  }, [editor, openLink]);

  // A click on a link shows its bubble, in place of following it.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest?.("a[href]");
      if (!link || !dom.contains(link)) return;
      e.preventDefault();
      setBubble(link as HTMLAnchorElement);
    };
    dom.addEventListener("click", onClick);
    return () => dom.removeEventListener("click", onClick);
  }, [editor]);

  const changeTitle = (next: string) => {
    if (unreadableRef.current) return;
    titleRef.current = next;
    setTitle(next);
    if (editor) onChange({ title: next, content: editor.getJSON() });
  };

  const closeBubble = useCallback(() => setBubble(null), []);

  return (
    <>
      {editor && (
        <EditorToolbar editor={editor} disabled={!canEdit} onLink={openLink} saveState={saveState} />
      )}
      {editor && canEdit && <TableBar editor={editor} />}
      {banner}
      <Paper
        title={title}
        onTitle={changeTitle}
        onTitleEnter={() => editor?.commands.focus("start")}
        readOnly={!canEdit}
        focusTitle={focusTitle && canEdit}
        meta={meta}
      >
        <div className={content.body}>
          <EditorContent editor={editor} />
        </div>
      </Paper>
      {bubble && (
        <LinkBubble
          link={bubble}
          onClose={closeBubble}
          onEdit={
            canEdit
              ? () => {
                  setBubble(null);
                  openLink();
                }
              : null
          }
        />
      )}
    </>
  );
}
