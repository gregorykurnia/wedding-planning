"use client";

import { useEffect, useRef, useState } from "react";
import { addPackage, updatePackage, useFinalist } from "@/lib/data/shortlist";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { useUploadQueue } from "@/lib/data/uploads";
import { n0 } from "@/lib/model/format";
import {
  ADD_PACKAGE_HINT,
  PACKAGE_ADD_FAILED,
  UNNAMED_PACKAGE,
  packageAddedToast,
  readCount,
  reviewsMessage,
  type FinalistFile,
  type PackageView,
} from "@/lib/model/finalist-detail";
import { FieldInput, FieldRow, Fields, FieldText } from "@/veil/parts/fields/fields";
import { MoneyInput } from "@/veil/parts/fields/money";
import { NumberInput } from "@/veil/parts/fields/number";
import { SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import { FileTiles } from "@/veil/parts/files/file-tiles";
import { Banner } from "@/veil/shell/banner";
import { CreateSheetActions, EditSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";

const NAME_PLACEHOLDER = "For example, Full styling";
const STEP_PLACEHOLDER = "What has to happen next";
const REVIEWS_PLACEHOLDER = "How many reviews mention it";

/**
 * "Add a package" (guide §5.14, F17): Cancel and Add package. The package's id
 * is made when the sheet opens and kept, so Try again after a lost connection
 * adds the same package and never a second. Its files wait until it exists.
 */
export function AddPackageSheet({ finalistId, finalistName }: { finalistId: string; finalistName: string }) {
  const sheet = useSheet();
  const toast = useToast();
  const id = useRef<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [includes, setIncludes] = useState("");
  const [reviewers, setReviewers] = useState<number | null>(null);
  const [step, setStep] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function add() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    id.current ??= crypto.randomUUID();
    const shown = name.trim() || UNNAMED_PACKAGE;
    try {
      const { undo } = await addPackage(finalistId, {
        id: id.current,
        name: shown,
        price: price ?? 0,
        includes,
        reviewers,
        step,
        notes,
      });
      toast.undoable(packageAddedToast(shown), undo);
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    sheet.close();
  }

  return (
    <Sheet title="Add a package" sub={finalistName}>
      <Fields>
        <FieldRow label="Name">
          <FieldInput autoFocus placeholder={NAME_PLACEHOLDER} value={name} onChange={setName} />
        </FieldRow>
        <FieldRow label="Price">
          <MoneyInput value={price} onCommit={setPrice} />
        </FieldRow>
        <FieldRow label="What’s included">
          <FieldText value={includes} onChange={setIncludes} />
        </FieldRow>
        <FieldRow label="Reviews">
          <NumberInput
            value={reviewers}
            onCommit={setReviewers}
            inputMode="numeric"
            placeholder={REVIEWS_PLACEHOLDER}
            show={n0}
            read={readCount}
            say={reviewsMessage}
          />
        </FieldRow>
        <FieldRow label="Next step">
          <FieldInput placeholder={STEP_PLACEHOLDER} value={step} onChange={setStep} />
        </FieldRow>
        <FieldRow label="Notes">
          <FieldText value={notes} onChange={setNotes} />
        </FieldRow>
        <FieldRow label="Files" group hint={ADD_PACKAGE_HINT}>
          <span />
        </FieldRow>
      </Fields>
      {failed && (
        <Banner tone="rose" inline>
          {PACKAGE_ADD_FAILED}
        </Banner>
      )}
      <CreateSheetActions
        action={failed ? "Try again" : "Add package"}
        busy={busy}
        busyLabel="Adding"
        onAction={() => void add()}
      />
    </Sheet>
  );
}

/**
 * "Edit package" (guide §5.14): every field saves as you go and Done closes. It
 * reads the finalist live, so the partner's change to this package shows in
 * place, and a package the partner removed closes the sheet. The finalist's own
 * price has only a name, a price and what's included: its reviews, next step,
 * notes and files are the finalist's, further down the page.
 */
export function EditPackageSheet({
  finalistId,
  finalistName,
  option: opened,
}: {
  finalistId: string;
  finalistName: string;
  option: PackageView;
}) {
  const sheet = useSheet();
  const read = useFinalist(finalistId);
  const live = read.data?.finalist?.packages.find((p) => p.id === opened.id) ?? null;
  const gone = read.status === "ready" && !live;
  const option = live ?? opened;
  const files = read.data?.finalist?.packageFiles[opened.id] ?? [];

  useEffect(() => {
    if (gone) sheet.close();
  }, [gone, sheet]);

  return (
    <SaveScopeProvider sheet>
      <Sheet title="Edit package" sub={finalistName}>
        <EditFields finalistId={finalistId} finalistName={finalistName} option={option} files={files} />
        <EditSheetActions />
      </Sheet>
    </SaveScopeProvider>
  );
}

function EditFields({
  finalistId,
  finalistName,
  option,
  files,
}: {
  finalistId: string;
  finalistName: string;
  option: PackageView;
  files: FinalistFile[];
}) {
  const change = (patch: Parameters<typeof updatePackage>[2]) => updatePackage(finalistId, option.id, patch);
  const name = useAutosaveField({
    value: option.name,
    required: true,
    normalize: (v: string) => v.trim(),
    save: (next: string) => change({ name: next }),
  });
  const price = useAutosaveField<number | null>({ value: option.price, save: (next) => change({ price: next ?? 0 }) });
  const includes = useAutosaveField({ value: option.includes, save: (next: string) => change({ includes: next }) });
  const reviewers = useAutosaveField<number | null>({ value: option.reviewers, save: (next) => change({ reviewers: next }) });
  const step = useAutosaveField({ value: option.step, save: (next: string) => change({ step: next }) });
  const notes = useAutosaveField({ value: option.notes, save: (next: string) => change({ notes: next }) });

  return (
    <Fields>
      <FieldRow label="Name" field={name}>
        <FieldInput {...name.bind} autoFocus placeholder={NAME_PLACEHOLDER} />
      </FieldRow>
      <FieldRow label="Price" field={price}>
        <MoneyInput {...price.bind} />
      </FieldRow>
      <FieldRow label="What’s included" field={includes}>
        <FieldText {...includes.bind} />
      </FieldRow>
      {option.main ? null : (
        <>
          <FieldRow label="Reviews" field={reviewers}>
            <NumberInput
              {...reviewers.bind}
              inputMode="numeric"
              placeholder={REVIEWS_PLACEHOLDER}
              show={n0}
              read={readCount}
              say={reviewsMessage}
            />
          </FieldRow>
          <FieldRow label="Next step" field={step}>
            <FieldInput {...step.bind} placeholder={STEP_PLACEHOLDER} />
          </FieldRow>
          <FieldRow label="Notes" field={notes}>
            <FieldText {...notes.bind} />
          </FieldRow>
          <FieldRow label="Files" group>
            <PackageFiles finalistId={finalistId} finalistName={finalistName} option={option} files={files} />
          </FieldRow>
        </>
      )}
    </Fields>
  );
}

/** The package's own files, filed under Files › Shortlist › the finalist › the package. */
function PackageFiles({
  finalistId,
  finalistName,
  option,
  files,
}: {
  finalistId: string;
  finalistName: string;
  option: PackageView;
  files: FinalistFile[];
}) {
  const queue = useUploadQueue({
    kind: "record",
    ref: { kind: "finalist", id: finalistId, partId: option.id },
    recordName: finalistName,
    partName: option.name,
  });
  return <FileTiles files={files} queue={queue} />;
}
