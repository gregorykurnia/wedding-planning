"use client";

import { useEffect, useRef, useState } from "react";
import { addPriceOption, updatePriceOption, useVendor } from "@/lib/data/vendors";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { OPTION_ADD_FAILED, UNNAMED_OPTION, optionAddedToast, type PriceOptionView } from "@/lib/model/vendor-detail";
import { Check, FieldInput, FieldRow, Fields, FieldText } from "@/veil/parts/fields/fields";
import { MoneyInput } from "@/veil/parts/fields/money";
import { SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import { Banner } from "@/veil/shell/banner";
import { CreateSheetActions, EditSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import { OfflineOr } from "@/veil/parts/fields/offline-or";

const LEANING = "The one we’re leaning towards";

/**
 * "Add a price option" (guide §5.12, F8): Cancel and Add option. The option's id
 * is made when the sheet opens and kept, so Try again after a lost connection
 * adds the same option and never a second. The first option starts as the one
 * we're leaning towards, since there is nothing else to lean towards.
 */
export function AddPriceOptionSheet({
  vendorId,
  vendorName,
  first,
}: {
  vendorId: string;
  vendorName: string;
  first: boolean;
}) {
  const sheet = useSheet();
  const toast = useToast();
  const id = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [includes, setIncludes] = useState("");
  const [leaning, setLeaning] = useState(first);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function add() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    id.current ??= crypto.randomUUID();
    const shown = name.trim() || UNNAMED_OPTION;
    try {
      const { undo } = await addPriceOption(vendorId, {
        id: id.current,
        name: shown,
        price: price ?? 0,
        includes,
        leaning,
      });
      toast.undoable(optionAddedToast(shown), undo);
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    sheet.close();
  }

  return (
    <Sheet title="Add a price option" sub={vendorName}>
      <Fields>
        <FieldRow label="Name">
          <FieldInput autoFocus placeholder="For example, Package B" value={name} onChange={setName} />
        </FieldRow>
        <FieldRow label="Price">
          <MoneyInput value={price} onCommit={setPrice} />
        </FieldRow>
        <FieldRow label="What’s included">
          <FieldText value={includes} onChange={setIncludes} />
        </FieldRow>
        <FieldRow label="" group>
          <Check value={leaning} onChange={setLeaning}>
            {LEANING}
          </Check>
        </FieldRow>
      </Fields>
      {failed && (
        <Banner tone="rose" inline>
          <OfflineOr>{OPTION_ADD_FAILED}</OfflineOr>
        </Banner>
      )}
      <CreateSheetActions
        action={failed ? "Try again" : "Add option"}
        busy={busy}
        busyLabel="Adding"
        onAction={() => void add()}
      />
    </Sheet>
  );
}

/**
 * "Edit price option" (guide §5.12): every field saves as you go and Done
 * closes. It reads the vendor live, so the partner's change to this option shows
 * in place, and an option the partner removed closes the sheet.
 */
export function EditPriceOptionSheet({
  vendorId,
  vendorName,
  option: opened,
}: {
  vendorId: string;
  vendorName: string;
  option: PriceOptionView;
}) {
  const sheet = useSheet();
  const read = useVendor(vendorId);
  const live = read.data?.vendor?.options.find((o) => o.id === opened.id) ?? null;
  const gone = read.status === "ready" && !live;
  const option = live ?? opened;

  useEffect(() => {
    if (gone) sheet.close();
  }, [gone, sheet]);

  return (
    <SaveScopeProvider sheet>
      <Sheet title="Edit price option" sub={vendorName}>
        <EditFields vendorId={vendorId} option={option} />
        <EditSheetActions />
      </Sheet>
    </SaveScopeProvider>
  );
}

function EditFields({ vendorId, option }: { vendorId: string; option: PriceOptionView }) {
  const change = (patch: Parameters<typeof updatePriceOption>[2]) => updatePriceOption(vendorId, option.id, patch);
  const name = useAutosaveField({
    value: option.name,
    required: true,
    normalize: (v: string) => v.trim(),
    save: (next: string) => change({ name: next }),
  });
  const price = useAutosaveField<number | null>({ value: option.price, save: (next) => change({ price: next ?? 0 }) });
  const includes = useAutosaveField({ value: option.includes, save: (next: string) => change({ includes: next }) });
  const leaning = useAutosaveField({ value: option.leaning, save: (next: boolean) => change({ leaning: next }) });

  return (
    <Fields>
      <FieldRow label="Name" field={name}>
        <FieldInput {...name.bind} autoFocus placeholder="For example, Package B" />
      </FieldRow>
      <FieldRow label="Price" field={price}>
        <MoneyInput {...price.bind} />
      </FieldRow>
      <FieldRow label="What’s included" field={includes}>
        <FieldText {...includes.bind} />
      </FieldRow>
      <FieldRow label="" group field={leaning}>
        <Check {...leaning.bind}>{LEANING}</Check>
      </FieldRow>
    </Fields>
  );
}
