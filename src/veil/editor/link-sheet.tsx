"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { linkHref, linkLabel } from "@/lib/model/documents";
import { Btn } from "@/veil/parts/actions/btn";
import { FieldInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { Sheet, SheetActions, useSheet } from "@/veil/shell/sheet";

/** Where the link goes in the text: the selection, or the whole link the cursor is in. */
export interface LinkTarget {
  from: number;
  to: number;
  /** The address of the link being edited, or null when adding one. */
  href: string | null;
  text: string;
}

/** The selection, widened to the whole link when the cursor sits in one. */
export function linkTargetOf(editor: Editor): LinkTarget {
  if (editor.isActive("link")) {
    const href = String(editor.getAttributes("link").href ?? "");
    editor.chain().extendMarkRange("link").run();
    const { from, to } = editor.state.selection;
    return { from, to, href, text: editor.state.doc.textBetween(from, to, " ") };
  }
  const { from, to } = editor.state.selection;
  return { from, to, href: null, text: editor.state.doc.textBetween(from, to, " ") };
}

/**
 * "Add a link" and "Edit link" (guide §4.24): Web address and Text. Adding has
 * Cancel and Add link; editing has Remove link and Save (decision 22). An
 * address without a scheme gets https://; one that isn't a web, mail or phone
 * address keeps the sheet open with focus in the field, as an empty one does.
 */
export function LinkSheet({ editor, target }: { editor: Editor; target: LinkTarget }) {
  const sheet = useSheet();
  const editing = target.href !== null;
  const [address, setAddress] = useState(target.href ?? "");
  const [text, setText] = useState(target.text);
  const addressInput = useRef<HTMLInputElement>(null);

  function save() {
    const href = linkHref(address);
    if (!href) {
      addressInput.current?.focus();
      return;
    }
    const label = text.trim() || linkLabel(href);
    const range = { from: target.from, to: target.to };
    const chain = editor.chain().focus();
    if (target.from !== target.to && label === target.text) {
      // The words stay as they are, bold and all; only the address changes.
      chain.setTextSelection(range).extendMarkRange("link").setLink({ href }).run();
    } else {
      chain
        .insertContentAt(range, { type: "text", text: label, marks: [{ type: "link", attrs: { href } }] })
        .unsetMark("link")
        .run();
    }
    sheet.close();
  }

  function removeLink() {
    editor.chain().focus().setTextSelection({ from: target.from, to: target.to }).unsetLink().run();
    sheet.close();
  }

  return (
    <Sheet title={editing ? "Edit link" : "Add a link"}>
      {/* The browser's own check would refuse "kebunbunga.id"; linkHref adds the https://. */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Fields>
          <FieldRow label="Web address">
            <FieldInput
              ref={addressInput}
              type="url"
              inputMode="url"
              autoFocus
              placeholder="https://"
              value={address}
              onChange={setAddress}
            />
          </FieldRow>
          <FieldRow label="Text">
            <FieldInput placeholder="What the link says" value={text} onChange={setText} />
          </FieldRow>
        </Fields>
        <SheetActions>
          {editing ? (
            <Btn variant="quiet" onClick={removeLink}>
              Remove link
            </Btn>
          ) : (
            <Btn variant="quiet" onClick={sheet.close}>
              Cancel
            </Btn>
          )}
          <Btn type="submit">{editing ? "Save" : "Add link"}</Btn>
        </SheetActions>
      </form>
    </Sheet>
  );
}
