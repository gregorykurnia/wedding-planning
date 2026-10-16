"use client";

import { useRef, useState } from "react";
import { addCategory, removeCategory, renameCategory } from "@/lib/data/categories";
import { usePartnerName } from "@/lib/data/partner";
import { mergeReads } from "@/lib/data/read";
import { useCategories, useVendors } from "@/lib/data/vendors";
import { newId } from "@/lib/data/write";
import {
  buildCategories,
  categoryRows,
  charactersLeft,
  validateCategoryName,
  type CategoryRow,
} from "@/lib/model/categories";
import { TextLink } from "@/veil/parts/actions/text-link";
import { FieldInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { InlineRename } from "@/veil/parts/fields/inline-rename";
import { MenuCardList, type MenuOption } from "@/veil/parts/menu-card/menu-card-list";
import { InlineConfirm } from "@/veil/shell/confirm";
import { CreateSheetActions, Sheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import {
  CATEGORY_ADD_FAILED,
  categoriesSub,
  categoryAdded,
  categoryNote,
  categoryRemoved,
  categoryRenamed,
  charactersNote,
  removeBody,
} from "./vendors-text";

type Mode = { kind: "rename" | "remove"; name: string } | null;

/**
 * "Vendor categories" (guide §5.11, F14, F23): the categories as a menu card,
 * with Rename and Remove on the ones we added (both undoable), and a field for a
 * new one. It reads the lists itself, since a sheet is opened once and must keep
 * up with the partner's changes.
 */
export function CategoriesSheet({
  onRenamed,
  onRemoved,
}: {
  /** The screen follows a category that was renamed (or the rename undone). */
  onRenamed: (from: string, to: string) => void;
  /** The screen stops focusing on a category that was removed. */
  onRemoved: (name: string) => void;
}) {
  const toast = useToast();
  const partner = usePartnerName().name;
  const read = mergeReads(useVendors(), useCategories());
  const [vendors, categories] = read.data ?? [[], { custom: [], list: buildCategories([]) }];

  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const id = useRef<string | null>(null);
  const removal = useRef<Awaited<ReturnType<typeof removeCategory>> | null>(null);

  const rows = categoryRows(
    categories.custom.map((c) => c.name),
    vendors,
  );
  const idOf = (name: string) => categories.custom.find((c) => c.name === name)?.id;

  async function add() {
    if (adding) return;
    const unusable = validateCategoryName(text, categories.list);
    if (unusable) {
      setProblem(unusable);
      return;
    }
    setAdding(true);
    id.current ??= newId("vendorCategories");
    try {
      const name = await addCategory(id.current, text);
      toast.confirmation(categoryAdded(name));
      id.current = null;
      setText("");
    } catch {
      setProblem(CATEGORY_ADD_FAILED);
    } finally {
      setAdding(false);
    }
  }

  function option(row: CategoryRow): MenuOption {
    const base: MenuOption = { id: row.name, name: row.name, note: categoryNote(row) };
    if (row.kind !== "ours") return base;
    const categoryId = idOf(row.name);
    if (!categoryId) return base;
    if (mode?.name === row.name && mode.kind === "rename") {
      return {
        ...base,
        replace: (
          <InlineRename
            name={row.name}
            label={`Rename ${row.name}`}
            check={(next) => validateCategoryName(next, categories.list.filter((c) => c !== row.name))}
            onSave={async (next) => {
              const renamed = await renameCategory(categoryId, next);
              toast.undoable(categoryRenamed(renamed.to), async () => {
                await renamed.undo();
                onRenamed(renamed.to, renamed.from);
              });
              onRenamed(renamed.from, renamed.to);
            }}
            onClose={() => setMode(null)}
          />
        ),
      };
    }
    if (mode?.name === row.name && mode.kind === "remove") {
      return {
        ...base,
        replace: (
          <InlineConfirm
            question={
              <>
                Remove <b dir="auto">{row.name}</b>?
              </>
            }
            body={removeBody(row.count)}
            action="Remove category"
            run={async () => {
              removal.current = await removeCategory(categoryId);
            }}
            onKeep={() => setMode(null)}
            onDone={() => {
              const done = removal.current;
              setMode(null);
              onRemoved(row.name);
              if (done) {
                toast.undoable(categoryRemoved(done.name), async () => {
                  await done.undo();
                });
              }
            }}
          />
        ),
      };
    }
    return {
      ...base,
      actions: (
        <>
          <TextLink onClick={() => setMode({ kind: "rename", name: row.name })}>Rename</TextLink>
          <TextLink tone="rose" onClick={() => setMode({ kind: "remove", name: row.name })}>
            Remove
          </TextLink>
        </>
      ),
    };
  }

  return (
    <Sheet title="Vendor categories" sub={categoriesSub(partner === "Your partner" ? "your partner" : partner)}>
      <MenuCardList options={rows.map(option)} />
      {/* One text field, so Enter submits the form and adds the category. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <Fields>
          <FieldRow label="New category" problem={problem} hint={charactersNote(charactersLeft(text))}>
            <FieldInput
              placeholder="Up to 40 characters"
              value={text}
              onChange={(next) => {
                setText(next);
                setProblem(null);
              }}
            />
          </FieldRow>
        </Fields>
      </form>
      <CreateSheetActions
        action="Add category"
        busyLabel="Adding"
        busy={adding}
        cancelLabel="Done"
        onAction={() => void add()}
      />
    </Sheet>
  );
}
