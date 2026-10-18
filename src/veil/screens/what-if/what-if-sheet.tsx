"use client";

import { useEffect, useRef, useState } from "react";
import type { WhatIfDoc } from "@/lib/data/adapters/what-if";
import { splitWhatIf, addWhatIfPart, removeWhatIfPart } from "@/lib/data/bookings";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { addWhatIf, setWhatIfField, setWhatIfPartField, useWhatIfPage } from "@/lib/data/what-if";
import { newId } from "@/lib/data/write";
import { buildCategories } from "@/lib/model/categories";
import { rp } from "@/lib/model/format";
import { NOT_ASSIGNED, whatIfTotal, type Funder, type WhatIfPartRecord } from "@/lib/model/money";
import {
  ACTION_FAILED,
  ADD_FAILED,
  ADD_PART,
  ADD_TITLE,
  EDIT_TITLE,
  IN_ALL,
  NAME_MISSING,
  PARTS_SMALL,
  REMOVE_PART,
  REMOVE_PART_LABEL,
  SHEET_SUB,
  SPLIT_ACTION,
  STAGES_ADD,
  STAGES_LEAD,
  STAGES_TAIL,
  addedToast,
} from "@/lib/model/what-if";
import { TextLink } from "@/veil/parts/actions/text-link";
import { ChipGroup } from "@/veil/parts/chips/chip";
import { FieldInput, FieldRow, Fields, FieldSelect } from "@/veil/parts/fields/fields";
import { MoneyInput } from "@/veil/parts/fields/money";
import { SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import { Banner } from "@/veil/shell/banner";
import { useFlasher } from "@/veil/shell/flash";
import { CreateSheetActions, EditSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import styles from "./what-if-sheet.module.css";

/** The funders as chips or a select: each one, then Not assigned (the empty value). */
const funderOptions = (funders: readonly Funder[]) => [
  ...funders.map((f) => ({ value: f.id, label: f.name })),
  { value: "", label: NOT_ASSIGNED },
];

/** The categories to offer, with the item's own when it isn't in the list any more. */
const categoryOptions = (categories: readonly string[], current?: string) =>
  [...categories, ...(current && !categories.includes(current) ? [current] : [])].map((c) => ({ value: c, label: c }));

/**
 * "Add a what-if item" (guide §5.10, B8, B10): what it is, category, price and who
 * would pay, with Cancel and Add item. A name is enough. The record's id is made
 * on the first press and kept until it lands, so Try again after a lost connection
 * writes the same item and never a second one. Splitting into parts comes after,
 * from the item's own sheet.
 */
export function AddWhatIfSheet() {
  const sheet = useSheet();
  const toast = useToast();
  const flash = useFlasher();
  const read = useWhatIfPage();
  const funders = read.data?.funders ?? [];
  const categories = read.data?.categories ?? buildCategories([]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Other");
  const [price, setPrice] = useState<number | null>(null);
  const [funder, setFunder] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = useRef<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  async function add() {
    if (busy) return;
    if (!name.trim()) {
      setProblem(NAME_MISSING);
      nameInput.current?.focus();
      return;
    }
    setFailed(false);
    setBusy(true);
    id.current ??= newId("hypotheticalItems");
    const itemId = id.current;
    try {
      const { undo } = await addWhatIf({ id: itemId, name, category, price, funder: funder || null });
      toast.undoable(addedToast(name.trim()), undo);
      flash({ kind: "whatif", id: itemId });
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    sheet.close();
  }

  return (
    <Sheet title={ADD_TITLE} sub={SHEET_SUB}>
      <Fields>
        <FieldRow label="What it is" problem={problem}>
          <FieldInput
            ref={nameInput}
            autoFocus
            placeholder="For example, a photo booth"
            value={name}
            onChange={(next) => {
              setName(next);
              setProblem(null);
            }}
          />
        </FieldRow>
        <FieldRow label="Category">
          <FieldSelect value={category} onChange={setCategory} options={categoryOptions(categories)} />
        </FieldRow>
        <FieldRow label="Price">
          <MoneyInput value={price} onCommit={setPrice} />
        </FieldRow>
        <FieldRow label="Who would pay" group>
          <ChipGroup label="Who would pay" options={funderOptions(funders)} value={funder} onChange={setFunder} />
        </FieldRow>
      </Fields>
      <p className={styles.stages}>{STAGES_ADD}</p>
      {failed && (
        <Banner tone="rose" inline>
          {ADD_FAILED}
        </Banner>
      )}
      <CreateSheetActions
        action={failed ? "Try again" : "Add item"}
        busy={busy}
        busyLabel="Adding"
        onAction={() => void add()}
      />
    </Sheet>
  );
}

/**
 * An item's sheet (guide §5.10): every field saves as you go and Done closes. It
 * reads the item live, so the partner's change shows in place and an item the
 * partner removed closes the sheet.
 */
export function EditWhatIfSheet({ itemId }: { itemId: string }) {
  const sheet = useSheet();
  const read = useWhatIfPage();
  const live = read.data?.items.find((i) => i.id === itemId) ?? null;
  const gone = read.status === "ready" && !live;

  // The last item read stays on show while the sheet closes after its removal.
  const [kept, setKept] = useState<WhatIfDoc | null>(live);
  if (live && live !== kept) setKept(live);
  const item = live ?? kept;

  useEffect(() => {
    if (gone) sheet.close();
  }, [gone, sheet]);

  return (
    <SaveScopeProvider sheet>
      {item && read.data ? (
        <EditBody item={item} funders={read.data.funders} categories={read.data.categories} />
      ) : (
        <Sheet title="What-if item" />
      )}
    </SaveScopeProvider>
  );
}

function EditBody({ item, funders, categories }: { item: WhatIfDoc; funders: Funder[]; categories: string[] }) {
  const { id } = item;
  const parts = item.subEntries ?? [];
  const inParts = parts.length > 0;

  const [splitting, setSplitting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  // The part whose name should take focus once it arrives (one just made).
  const [focusPart, setFocusPart] = useState<string | null>(null);

  const name = useAutosaveField({
    value: item.name,
    required: true,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setWhatIfField(id, "name", next),
  });
  const category = useAutosaveField({
    value: item.category,
    save: (next: string) => setWhatIfField(id, "category", next),
  });
  const price = useAutosaveField<number | null>({
    value: item.totalPrice,
    save: (next) => setWhatIfField(id, "price", next ?? 0),
  });
  const funder = useAutosaveField<string>({
    value: funders.some((f) => f.id === item.funder) ? (item.funder as string) : "",
    save: (next) => setWhatIfField(id, "funder", next || null),
  });

  async function split() {
    if (splitting) return;
    setSplitting(true);
    setActionFailed(false);
    try {
      const done = await splitWhatIf(id);
      setFocusPart(done.partIds[0] ?? null);
    } catch {
      setActionFailed(true);
    }
    setSplitting(false);
  }

  async function addPart() {
    if (adding) return;
    setAdding(true);
    setActionFailed(false);
    try {
      const done = await addWhatIfPart(id);
      setFocusPart(done.partId);
    } catch {
      setActionFailed(true);
    }
    setAdding(false);
  }

  async function removePart(partId: string) {
    setActionFailed(false);
    try {
      await removeWhatIfPart(id, partId);
    } catch {
      setActionFailed(true);
    }
  }

  return (
    <Sheet title={EDIT_TITLE(item.name)} sub={SHEET_SUB}>
      <Fields>
        <FieldRow label="What it is" field={name}>
          <FieldInput {...name.bind} placeholder="For example, a photo booth" />
        </FieldRow>
        <FieldRow label="Category" field={category}>
          <FieldSelect {...category.bind} options={categoryOptions(categories, item.category)} />
        </FieldRow>
        {!inParts && (
          <>
            <FieldRow label="Price" field={price}>
              <MoneyInput {...price.bind} />
            </FieldRow>
            <FieldRow label="Who would pay" group field={funder}>
              <ChipGroup
                label="Who would pay"
                options={funderOptions(funders)}
                value={funder.draft}
                disabled={funder.disabled}
                onChange={funder.commit}
              />
            </FieldRow>
          </>
        )}
      </Fields>

      {inParts ? (
        <>
          <h3 className={styles.partsHead}>
            <span>Parts</span>
            <small>{PARTS_SMALL(parts.length)}</small>
          </h3>
          <p className={styles.total}>
            <span className="num">{rp(whatIfTotal(item))}</span> {IN_ALL}
          </p>
          <ul className={styles.parts}>
            {parts.map((part) => (
              <PartEditRow
                key={part.id}
                itemId={id}
                part={part}
                inheritedFunder={item.funder ?? null}
                funders={funders}
                focus={focusPart === part.id}
                onFocused={() => setFocusPart(null)}
                onRemove={() => void removePart(part.id)}
              />
            ))}
          </ul>
          <p className={styles.add}>
            <TextLink busy={adding} busyLabel="Adding" onClick={() => void addPart()}>
              {ADD_PART}
            </TextLink>
          </p>
        </>
      ) : (
        <p className={styles.stages}>
          {STAGES_LEAD}
          <TextLink busy={splitting} busyLabel="Splitting" onClick={() => void split()}>
            {SPLIT_ACTION}
          </TextLink>
          {STAGES_TAIL}
        </p>
      )}
      {actionFailed && (
        <p className={styles.failure} role="alert">
          {ACTION_FAILED}
        </p>
      )}

      <EditSheetActions />
    </Sheet>
  );
}

/**
 * One part (guide §5.10): its name, price and who would pay, each saving as you go,
 * and Remove. Removing down to one part merges it back into a single item, which
 * the sheet then shows as one.
 */
function PartEditRow({
  itemId,
  part,
  inheritedFunder,
  funders,
  focus,
  onFocused,
  onRemove,
}: {
  itemId: string;
  part: WhatIfPartRecord;
  /** What a part with no funder of its own reads as. */
  inheritedFunder: string | null;
  funders: Funder[];
  focus: boolean;
  onFocused: () => void;
  onRemove: () => void;
}) {
  const partId = part.id;
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focus) return;
    nameInput.current?.focus();
    nameInput.current?.select();
    onFocused();
  }, [focus, onFocused]);

  const name = useAutosaveField({
    value: part.name,
    required: true,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setWhatIfPartField(itemId, partId, "name", next),
  });
  const price = useAutosaveField<number | null>({
    value: part.totalPrice,
    save: (next) => setWhatIfPartField(itemId, partId, "price", next ?? 0),
  });
  const own = part.funder ?? inheritedFunder;
  const funder = useAutosaveField<string>({
    value: funders.some((f) => f.id === own) ? (own as string) : "",
    save: (next) => setWhatIfPartField(itemId, partId, "funder", next || null),
  });

  return (
    <li className={styles.part} data-part-id={partId}>
      <div className={`${styles.cell} ${styles.cellName}`}>
        <FieldRow label="Part name" hideLabel field={name}>
          <FieldInput {...name.bind} ref={nameInput} />
        </FieldRow>
      </div>
      <div className={styles.cell}>
        <FieldRow label="Price" hideLabel field={price}>
          <MoneyInput {...price.bind} />
        </FieldRow>
      </div>
      <div className={styles.cell}>
        <FieldRow label="Who would pay" hideLabel field={funder}>
          <FieldSelect {...funder.bind} options={funderOptions(funders)} />
        </FieldRow>
      </div>
      <div className={styles.remove}>
        <TextLink tone="rose" onClick={onRemove}>
          <span aria-hidden="true">{REMOVE_PART}</span>
          <span className="sr">{REMOVE_PART_LABEL(part.name)}</span>
        </TextLink>
      </div>
    </li>
  );
}
