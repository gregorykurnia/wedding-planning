import { Extension, getStyleProperty } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import { FontFamily, FontSize, TextStyleKit } from "@tiptap/extension-text-style";
import { fontKeyOf, fontStored, sizeKeyOf, sizeStored } from "@/lib/model/documents";

/**
 * The editor's schema: StarterKit, TextStyleKit and TableKit, as the old
 * editor had them, so every stored document opens and saves in the same shape
 * (plan §2.8). Only the drawing of fonts and sizes differs:
 *
 * - a font is stored by name ("Georgia", "Courier New") and drawn through a
 *   `data-font` attribute, so the content styles can give it the app's own
 *   loaded fonts (next/font renames the families);
 * - fonts and sizes pasted in from elsewhere are read as one of the four (Q10).
 */
const DocFontFamily = FontFamily.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              fontStored(fontKeyOf(getStyleProperty(element, "font-family") ?? element.style.fontFamily)),
            renderHTML: (attributes: { fontFamily?: string | null }) =>
              attributes.fontFamily ? { "data-font": fontKeyOf(attributes.fontFamily) } : {},
          },
        },
      },
    ];
  },
});

const DocFontSize = FontSize.extend({
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              sizeStored(sizeKeyOf(getStyleProperty(element, "font-size") ?? element.style.fontSize)),
            renderHTML: (attributes: { fontSize?: string | null }) =>
              attributes.fontSize ? { "data-size": sizeKeyOf(attributes.fontSize) } : {},
          },
        },
      },
    ];
  },
});

/** The event Cmd/Ctrl+K sends on the editor's element; the editor opens "Add a link" (guide §4.24). */
export const LINK_SHORTCUT_EVENT = "veil-doc-link";

const LinkShortcut = Extension.create({
  name: "linkShortcut",
  addKeyboardShortcuts() {
    return {
      "Mod-k": () => {
        this.editor.view.dom.dispatchEvent(new CustomEvent(LINK_SHORTCUT_EVENT));
        return true;
      },
    };
  },
});

export function docExtensions() {
  return [
    StarterKit.configure({
      // A click on a link shows the link bubble; the address opens from there.
      link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: "https" },
    }),
    TextStyleKit.configure({ fontFamily: false, fontSize: false }),
    DocFontFamily,
    DocFontSize,
    // Tables and their tools are Task 4.18; the schema is here so tables open and save.
    TableKit.configure({ table: { resizable: false } }),
    LinkShortcut,
  ];
}
