"use client";

import { useRef, useState } from "react";
import { addCategory, removeCategory, renameCategory } from "@/lib/data/categories";
import { useItems } from "@/lib/data/items";
import { usePartnerName } from "@/lib/data/partner";
import { useOnline } from "@/lib/data/session";
import { useVendorsAndCategories } from "@/lib/data/vendors";
import { newId } from "@/lib/data/write";
import {
  categoryList,
  categoryRows,
  charactersLeft,
  MAX_CATEGORY_LENGTH,
  OTHER_CATEGORY,
  validateCategoryName,
  type CategoryRow,
} from "@/lib/model/categories";
import { offlineOr } from "@/lib/model/save-state";
import { TextLink } from "@/veil/parts/actions/text-link";
import { FieldInput, FieldRow, Fields, FieldSelect } from "@/veil/parts/fields/fields";
import { InlineRename } from "@/veil/parts/fields/inline-rename";
import { MenuCardList, type MenuOption } from "@/veil/parts/menu-card/menu-card-list";
import { InlineConfirm } from "@/veil/shell/confirm";
import { CreateSheetActions, Sheet } from "@/veil/shell/sheet";
import { useSheetFailure } from "@/veil/shell/sheet-failure";
import { useToast } from "@/veil/shell/toasts";
import {
  CATEGORY_ADD_FAILED,
  categoriesSub,
  categoryAdded,
  categoryNote,
  categoryRemoved,
  categoryRenamed,
  CATEGORIES_TITLE,
  charactersNote,
  MOVE_TO_LABEL,
  removeBody,
} from "./vendors-text";

type Mode = { kind: "rename" | "remove"; name: string } | null;

/**
 * "Categories" (guide §5.11, F14, F23): the shared categories as a menu card,
 * with Rename and Remove on every one but Other (both undoable), and a field for
 * a new one. Remove asks where what's in it goes, Other unless another is
 * chosen, so two categories that mean the same can be made one. It reads the
 * lists itself, since a sheet is opened once and must keep up with the
 * partner's changes.
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
  const read = useVendorsAndCategories();
  const [vendors, categories] = read.data ?? [[], { stored: [], list: categoryList([]) }];
  const items = useItems().data ?? [];

  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState(OTHER_CATEGORY);
  const [adding, setAdding] = useState(false);
  const id = useRef<string | null>(null);
  const removal = useRef<Awaited<ReturnType<typeof removeCategory>> | null>(null);
  // A failed add is the field's problem line, not a rose Banner: it tells the sheet itself (P7-S13).
  useSheetFailure(problem === CATEGORY_ADD_FAILED);
  const offline = !useOnline();

  const rows = categoryRows(categories.stored, vendors, items);

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
    const categoryId = row.id;
    if (!categoryId) return base;
    if (mode?.name === row.name && mode.kind === "rename") {
      return {
        ...base,
        replace: (
          <InlineRename
            name={row.name}
            label={`Rename ${row.name}`}
            maxLength={MAX_CATEGORY_LENGTH}
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
            body={removeBody(row)}
            extra={
              row.vendors + row.items > 0 && (
                <Fields>
                  <FieldRow label={MOVE_TO_LABEL}>
                    <FieldSelect
                      value={moveTo}
                      onChange={setMoveTo}
                      options={categories.list.filter((c) => c !== row.name).map((c) => ({ value: c, label: c }))}
                    />
                  </FieldRow>
                </Fields>
              )
            }
            action="Remove category"
            run={async () => {
              removal.current = await removeCategory(categoryId, moveTo);
            }}
            onKeep={() => setMode(null)}
            onDone={() => {
              const done = removal.current;
              setMode(null);
              onRemoved(row.name);
              if (done) {
                toast.undoable(categoryRemoved(done.name, done.moved ? done.to : null), async () => {
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
          <TextLink
            tone="rose"
            onClick={() => {
              setMoveTo(OTHER_CATEGORY);
              setMode({ kind: "remove", name: row.name });
            }}
          >
            Remove
          </TextLink>
        </>
      ),
    };
  }

  return (
    <Sheet title={CATEGORIES_TITLE} sub={categoriesSub(partner === "Your partner" ? "your partner" : partner)}>
      <MenuCardList options={rows.map(option)} />
      {/* One text field, so Enter submits the form and adds the category. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <Fields>
          <FieldRow label="New category" problem={problem === CATEGORY_ADD_FAILED ? offlineOr(problem, offline) : problem} hint={charactersNote(charactersLeft(text))}>
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
