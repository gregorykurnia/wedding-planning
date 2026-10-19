"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDirectBooking, bookingIdOf } from "@/lib/data/bookings";
import { mergeStatus } from "@/lib/data/read";
import { useSession } from "@/lib/data/session";
import { recordFolderPath, type RecordRef } from "@/lib/data/adapters/files";
import type { UploadTarget } from "@/lib/data/upload-queue";
import { recordFolder, useUploadQueue, useUploads } from "@/lib/data/uploads";
import { useFunders } from "@/lib/data/use-funders";
import { useToday } from "@/lib/data/use-today";
import { useCategories } from "@/lib/data/vendors";
import { newId } from "@/lib/data/write";
import type { FunderId } from "@/lib/model/bookings";
import {
  ADDING,
  ADD_BOOKING,
  ADD_FAILED,
  ATTACH_FILE,
  BOOKING_SUB,
  CHOOSE_CATEGORY,
  DEMO_ADDING,
  FILES_WAITING,
  FILE_FAILED,
  INSTALMENTS_NOTE,
  NOT_ASSIGNED,
  TRY_AGAIN,
  addedText,
  directBookingDraft,
  nameProblem,
} from "@/lib/model/direct-booking";
import type { Funder } from "@/lib/model/money";
import { statusView } from "@/lib/model/uploads";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { ChipGroup } from "@/veil/parts/chips/chip";
import { DateInput, FieldInput, FieldRow, Fields, FieldSelect } from "@/veil/parts/fields/fields";
import { MoneyInput } from "@/veil/parts/fields/money";
import { useUploadSheet } from "@/veil/parts/files/upload-sheet";
import { Hero } from "@/veil/parts/hero/hero";
import { veilHref } from "@/veil/href";
import { Banner } from "@/veil/shell/banner";
import { BackLink } from "@/veil/shell/back-link";
import { useFlasher } from "@/veil/shell/flash";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useToast } from "@/veil/shell/toasts";
import styles from "./booking-new.module.css";

const BUDGET = "/budget";
const BOOKINGS = "/budget/bookings";

/**
 * Add a booking (guide §5.7, B2): something booked outside Vendors and Venues.
 * Files attached while adding are uploaded first, to Files, and linked to the
 * booking when it is added. The record id is made on the first press and kept
 * until it lands, so Try again writes the same booking and never a second one.
 */
export function BookingNewScreen() {
  const { connection } = useSession();
  const funders = useFunders();
  const categories = useCategories();
  const status = mergeStatus(funders, categories);
  const read = {
    status,
    data: status === "demo" ? null : { funders: funders.data?.funders ?? [], categories: categories.data?.list ?? [] },
  };
  return (
    <PageColumn>
      <BackLink path={BUDGET} label="Budget" />
      <Hero title="Add a booking" sub={BOOKING_SUB} />
      <ScreenState read={read} what="the form" onRetry={() => window.location.reload()}>
        {(data) => (
          <AddForm funders={data?.funders ?? []} categories={data?.categories ?? []} inDemo={connection === "demo"} />
        )}
      </ScreenState>
    </PageColumn>
  );
}

function AddForm({ funders, categories, inDemo }: { funders: Funder[]; categories: string[]; inDemo: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const flash = useFlasher();
  const today = useToday();
  const [name, setName] = useState("");
  // There's no booking to file under until it's added: files wait at the top of
  // Files and move into the booking's own folder with the add (P4-S6), which is
  // where the sheet says they go.
  const target: UploadTarget = { kind: "folder", folderId: null, path: recordFolderPath({ kind: "booking", id: "" }, name) };
  const queue = useUploadQueue(target, undefined, inDemo);
  const { items } = useUploads(queue);
  const openUploads = useUploadSheet(queue);

  const [category, setCategory] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [paid, setPaid] = useState<number | null>(null);
  const [funder, setFunder] = useState<FunderId>(null);
  const [due, setDue] = useState("");
  const [step, setStep] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const id = useRef<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  const uploading = items.some((i) => i.status === "shrinking" || i.status === "uploading");
  const fileFailed = items.some((i) => i.status === "failed");

  async function add() {
    if (adding || inDemo || uploading || fileFailed) return;
    const missing = nameProblem(name);
    if (missing) {
      setProblem(missing);
      nameInput.current?.focus();
      return;
    }
    setFailed(false);
    setAdding(true);
    const recordId = (id.current ??= newId("vendors"));
    const draft = directBookingDraft({
      name,
      category,
      price,
      paid,
      funder,
      due,
      step,
      files: items.flatMap((i) => (i.status === "done" && i.fileId ? [i.fileId] : [])),
    });
    try {
      // Found by what it belongs to, so Try again reuses the folder a failed add made.
      const ref: RecordRef = { kind: "booking", id: bookingIdOf({ kind: "vendor", id: recordId }) };
      const folderId = draft.files?.length ? await recordFolder(ref, recordFolderPath(ref, draft.name)) : undefined;
      await addDirectBooking({ ...draft, folderId }, today, { id: recordId });
    } catch {
      setAdding(false);
      setFailed(true);
      return;
    }
    toast.confirmation(addedText(draft.name));
    flash({ kind: "booking", id: bookingIdOf({ kind: "vendor", id: recordId }) });
    router.push(veilHref(BOOKINGS));
  }

  const funderOptions = [...funders.map((f) => ({ value: f.id, label: f.name })), { value: "", label: NOT_ASSIGNED }];

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
    >
      <Fields>
        <FieldRow label="What it is" problem={problem}>
          <FieldInput
            ref={nameInput}
            dir="auto"
            placeholder="For example, Sakura Transport"
            value={name}
            onChange={(next) => {
              setName(next);
              setProblem(null);
            }}
          />
        </FieldRow>
        <FieldRow label="Category">
          <FieldSelect
            value={category}
            onChange={setCategory}
            options={[{ value: "", label: CHOOSE_CATEGORY }, ...categories.map((c) => ({ value: c, label: c }))]}
          />
        </FieldRow>
        <FieldRow label="Agreed price">
          <MoneyInput value={price} onCommit={setPrice} />
        </FieldRow>
        <FieldRow label="Paid so far">
          <MoneyInput value={paid} onCommit={setPaid} />
        </FieldRow>
        <FieldRow label="Funder" group>
          <ChipGroup
            label="Funder"
            options={funderOptions}
            value={funder ?? ""}
            onChange={(value) => setFunder(value || null)}
          />
        </FieldRow>
        <FieldRow label="Next due date">
          <DateInput value={due} onChange={setDue} />
        </FieldRow>
        <FieldRow label="Next step">
          <FieldInput placeholder="What has to happen next" value={step} onChange={setStep} />
        </FieldRow>
        <FieldRow
          label="Files"
          group
          hint={uploading ? FILES_WAITING : undefined}
          problem={fileFailed && !uploading ? FILE_FAILED : undefined}
        >
          <div className={styles.files}>
            <TextLink onClick={openUploads}>
              {ATTACH_FILE}
            </TextLink>
            {items.length > 0 && (
              <ul className={styles.list} aria-label="Files for this booking">
                {items.map((item) => {
                  const view = statusView(item, true);
                  const tone = view.tone === "ok" ? styles.ok : view.tone === "bad" ? styles.bad : "";
                  return (
                    <li key={item.id}>
                      <span className={styles.fileName} dir="auto">
                        {item.name}
                      </span>
                      <span className={`${styles.status} ${tone}`}>{view.text}</span>
                      {view.retry && (
                        <TextLink tone="rose" onClick={() => queue.retry(item.id)}>
                          {TRY_AGAIN}
                        </TextLink>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </FieldRow>
      </Fields>
      <p className={styles.note}>{INSTALMENTS_NOTE}</p>
      {failed && (
        <Banner tone="rose" inline>
          {ADD_FAILED}
        </Banner>
      )}
      <div className={styles.actions}>
        <Btn variant="quiet" href={veilHref(BUDGET)}>
          Cancel
        </Btn>
        <Btn type="submit" busy={adding} busyLabel={ADDING} disabled={inDemo || uploading || fileFailed}>
          {failed ? TRY_AGAIN : ADD_BOOKING}
        </Btn>
      </div>
      {inDemo && <p className={styles.demo}>{DEMO_ADDING}</p>}
    </form>
  );
}
