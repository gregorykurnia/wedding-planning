"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  DOC_BLOCKS,
  DOC_FONTS,
  DOC_SIZES,
  fontKeyOf,
  fontStored,
  sizeKeyOf,
  sizeStored,
  type DocBlockKey,
  type DocFontKey,
  type DocSizeKey,
} from "@/lib/model/documents";
import { ColourPop, HighlightPop, TableSizePop } from "./pops";
import {
  BulletsGlyph,
  ClearGlyph,
  ColourGlyph,
  HighlightGlyph,
  LinkGlyph,
  NumbersGlyph,
  RedoGlyph,
  TableGlyph,
  UndoGlyph,
} from "./toolbar-icons";
import styles from "./toolbar.module.css";

function blockOf(editor: Editor): DocBlockKey {
  if (editor.isActive("heading", { level: 1 })) return "title";
  if (editor.isActive("heading", { level: 2 })) return "heading";
  if (editor.isActive("heading", { level: 3 })) return "subheading";
  if (editor.isActive("blockquote")) return "quote";
  if (editor.isActive("codeBlock")) return "code";
  return "paragraph";
}

function setBlock(editor: Editor, key: DocBlockKey) {
  const chain = editor.chain().focus();
  switch (key) {
    case "title":
      return chain.setHeading({ level: 1 }).run();
    case "heading":
      return chain.setHeading({ level: 2 }).run();
    case "subheading":
      return chain.setHeading({ level: 3 }).run();
    case "quote":
      return chain.setParagraph().setBlockquote().run();
    case "code":
      return chain.setCodeBlock().run();
    default:
      return chain.unsetBlockquote().setParagraph().run();
  }
}

function setFont(editor: Editor, key: DocFontKey) {
  const stored = fontStored(key);
  const chain = editor.chain().focus();
  return stored ? chain.setFontFamily(stored).run() : chain.unsetFontFamily().run();
}

function setSize(editor: Editor, key: DocSizeKey) {
  const stored = sizeStored(key);
  const chain = editor.chain().focus();
  return stored ? chain.setFontSize(stored).run() : chain.unsetFontSize().run();
}

type ToolProps = {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  popup?: boolean;
  onPress: (button: HTMLButtonElement) => void;
  children: ReactNode;
};

/** One 34px toolbar button. A press doesn't take focus from the text, so the selection stays. */
function Tool({ label, pressed, disabled, popup, onPress, children }: ToolProps) {
  return (
    <button
      type="button"
      className={styles.tb}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-haspopup={popup ? "dialog" : undefined}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => onPress(e.currentTarget)}
    >
      {children}
    </button>
  );
}

type PopKind = "colour" | "highlight" | "table";
type Pop = { kind: PopKind; anchor: HTMLButtonElement } | null;

type EditorToolbarProps = {
  editor: Editor;
  /** Off in demonstration mode: the document can be read, not changed. */
  disabled: boolean;
  /** "Add a link" (or "Edit link" when the cursor is in one). */
  onLink: () => void;
  /** The save state, at the far end (guide §4.24). */
  saveState: ReactNode;
};

/**
 * The formatting toolbar (guide §4.24): Undo/Redo · Text style, Font, Size ·
 * bold, italic, underline, strikethrough · Text colour, Highlight · Bullet
 * points, Numbered steps · Link, Table, Clear formatting, then the save state.
 * Table opens the size grid; the table bar (`table-bar.tsx`) has the rest.
 */
export function EditorToolbar({ editor, disabled, onLink, saveState }: EditorToolbarProps) {
  const id = useId();
  const [pop, setPop] = useState<Pop>(null);
  const bar = useRef<HTMLDivElement>(null);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const style = e.getAttributes("textStyle");
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        bullets: e.isActive("bulletList"),
        numbers: e.isActive("orderedList"),
        link: e.isActive("link"),
        block: blockOf(e),
        font: fontKeyOf(style.fontFamily),
        size: sizeKeyOf(style.fontSize),
        colour: typeof style.color === "string" ? style.color : null,
        highlight: typeof style.backgroundColor === "string" ? style.backgroundColor : null,
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  const toggle = (kind: PopKind, anchor: HTMLButtonElement) =>
    setPop((open) => (open?.kind === kind ? null : { kind, anchor }));
  const closePop = () => setPop(null);

  return (
    <div ref={bar} className={styles.toolbar} role="toolbar" aria-label="Formatting" data-editor-toolbar="">
      <div className={styles.tg}>
        <Tool label="Undo" disabled={disabled || !s.canUndo} onPress={() => editor.chain().focus().undo().run()}>
          <UndoGlyph />
        </Tool>
        <Tool label="Redo" disabled={disabled || !s.canRedo} onPress={() => editor.chain().focus().redo().run()}>
          <RedoGlyph />
        </Tool>
      </div>
      <div className={styles.tg}>
        <label className="sr" htmlFor={`${id}-block`}>
          Text style
        </label>
        <select
          id={`${id}-block`}
          className={styles.tsel}
          value={s.block}
          disabled={disabled}
          onChange={(e) => setBlock(editor, e.target.value as DocBlockKey)}
        >
          {DOC_BLOCKS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
        <label className="sr" htmlFor={`${id}-font`}>
          Font
        </label>
        <select
          id={`${id}-font`}
          className={styles.tsel}
          value={s.font}
          disabled={disabled}
          onChange={(e) => setFont(editor, e.target.value as DocFontKey)}
        >
          {DOC_FONTS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        <label className="sr" htmlFor={`${id}-size`}>
          Size
        </label>
        <select
          id={`${id}-size`}
          className={styles.tsel}
          value={s.size}
          disabled={disabled}
          onChange={(e) => setSize(editor, e.target.value as DocSizeKey)}
        >
          {DOC_SIZES.map((z) => (
            <option key={z.key} value={z.key}>
              {z.label}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.tg}>
        <Tool label="Bold" pressed={s.bold} disabled={disabled} onPress={() => editor.chain().focus().toggleBold().run()}>
          <b>B</b>
        </Tool>
        <Tool label="Italic" pressed={s.italic} disabled={disabled} onPress={() => editor.chain().focus().toggleItalic().run()}>
          <i>I</i>
        </Tool>
        <Tool
          label="Underline"
          pressed={s.underline}
          disabled={disabled}
          onPress={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </Tool>
        <Tool
          label="Strikethrough"
          pressed={s.strike}
          disabled={disabled}
          onPress={() => editor.chain().focus().toggleStrike().run()}
        >
          <s>S</s>
        </Tool>
      </div>
      <div className={styles.tg}>
        <Tool label="Text colour" popup disabled={disabled} onPress={(b) => toggle("colour", b)}>
          <ColourGlyph />
        </Tool>
        <Tool label="Highlight" popup disabled={disabled} onPress={(b) => toggle("highlight", b)}>
          <HighlightGlyph />
        </Tool>
      </div>
      <div className={styles.tg}>
        <Tool
          label="Bullet points"
          pressed={s.bullets}
          disabled={disabled}
          onPress={() => editor.chain().focus().toggleBulletList().run()}
        >
          <BulletsGlyph />
        </Tool>
        <Tool
          label="Numbered steps"
          pressed={s.numbers}
          disabled={disabled}
          onPress={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <NumbersGlyph />
        </Tool>
      </div>
      <div className={styles.tg}>
        <Tool label="Link" pressed={s.link} disabled={disabled} popup onPress={onLink}>
          <LinkGlyph />
        </Tool>
        <Tool label="Table" disabled={disabled} popup onPress={(b) => toggle("table", b)}>
          <TableGlyph />
        </Tool>
        <Tool
          label="Clear formatting"
          disabled={disabled}
          onPress={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          <ClearGlyph />
        </Tool>
      </div>
      {saveState}
      {pop?.kind === "colour" && (
        <ColourPop editor={editor} anchor={pop.anchor} current={s.colour} onClose={closePop} />
      )}
      {pop?.kind === "highlight" && (
        <HighlightPop editor={editor} anchor={pop.anchor} current={s.highlight} onClose={closePop} />
      )}
      {pop?.kind === "table" && <TableSizePop editor={editor} anchor={pop.anchor} onClose={closePop} />}
    </div>
  );
}
