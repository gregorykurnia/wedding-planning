"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useSession } from "@/lib/data/session";
import type { Undoable } from "@/lib/data/undo";
import type { UploadDeps, UploadTarget } from "@/lib/data/upload-queue";
import { useUploadQueue, useUploads } from "@/lib/data/uploads";
import { amountMessage, amountProblem, readAmount } from "@/lib/model/amount";
import { isIsoDate, localIso } from "@/lib/model/dates";
import { rp } from "@/lib/model/format";
import { leftOf, type Funder } from "@/lib/model/money";
import {
  DEMO_RECORDING,
  funderOfValue,
  paidByChoices,
  PAYMENT_ACTION,
  PAYMENT_BUSY,
  PAYMENT_TITLE,
  paymentConflict,
  paymentConflictOwn,
  paymentPart,
  paymentSub,
  previewLine,
  RECEIPT_FAILED,
  RECEIPT_WAITING,
  RECORD_FAILED,
  recordedText,
  startAmount,
  startPaidBy,
} from "@/lib/model/payment";
import { partsOf, type Booking, type FunderId, type Rupiah } from "@/lib/model/bookings";
import { statusView } from "@/lib/model/uploads";
import { TextLink } from "@/veil/parts/actions/text-link";
import { ChipGroup } from "@/veil/parts/chips/chip";
import { DateInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { BigInput } from "@/veil/parts/fields/money";
import { UploadSheet } from "@/veil/parts/files/upload-sheet";
import { Banner } from "@/veil/shell/banner";
import { CreateSheetActions, Sheet, useSheet, useSheets } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import styles from "./payment.module.css";

export interface PaymentEntry {
  amount: Rupiah;
  paidOn: string | null;
  paidBy: FunderId;
  receiptFileId: string | null;
}

/** Writes the payment. `paymentId` is made once per sheet, so Try again never records two. */
export type RecordFn = (entry: PaymentEntry, on: { partId: string | null; paymentId: string }) => Promise<Undoable>;

type RecordPaymentSheetProps = {
  /** The booking as it is now: the preview line follows it, so a partner's payment shows. */
  booking: Booking;
  /** Which part the payment goes on; without one, the booking's next step. */
  partId?: string | null;
  funders: readonly Funder[];
  record: RecordFn;
  /** The receipt's upload pipeline; the gallery passes a stand-in. */
  uploadDeps?: UploadDeps;
  /** Overrides the session's demonstration mode, for the gallery. */
  demo?: boolean;
};

const makeId = () => crypto.randomUUID();

/**
 * Record a payment (guide §5.4, §6.9, B6): the amount, big, starting as what's
 * left; a line under it saying what the payment does; Paid on; Paid by; and a
 * receipt through the shared upload sheet, filed into the booking's folder. The
 * payment is a write with an Undo toast. Text that isn't an amount puts the
 * old amount back and says why (N16).
 */
export function RecordPaymentSheet({ booking, partId = null, funders, record, uploadDeps, demo }: RecordPaymentSheetProps) {
  const sheet = useSheet();
  const sheets = useSheets();
  const toast = useToast();
  const field = useId();
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const paymentId = useRef<string | null>(null);
  // A press on Record takes focus off the amount first: it must be read, not refused, by the press.
  const pressing = useRef(false);

  // The part is chosen when the sheet opens, so a partner's change can't move it to another part.
  const [chosenId, setChosenId] = useState(() => paymentPart(booking, partId)?.id ?? null);
  // The partner split the booking while the sheet was open: it no longer takes a
  // payment of its own, so the payment goes on the part the sheet now names (its
  // next step), chosen once, rather than failing every time.
  if (chosenId === null && booking.parts.length > 0) setChosenId(paymentPart(booking, null)?.id ?? null);
  const part =
    partsOf(booking).find((p) => p.id === chosenId) ?? paymentPart(booking, chosenId) ?? partsOf(booking)[0];
  const [opening] = useState(() => ({ amount: startAmount(part) }));
  // The amount before the one being typed, which a refused text puts back.
  const before = useRef<Rupiah | null>(opening.amount);

  const [text, setText] = useState(opening.amount === null ? "" : rp(opening.amount));
  const [refusal, setRefusal] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState(() => localIso(new Date()));
  // Until one is chosen, Paid by is the part's funder, read as the funders arrive: the sheet
  // can open before they have loaded.
  const [chosenPaidBy, setPaidBy] = useState<string | null>(null);
  const paidBy = chosenPaidBy ?? startPaidBy(part, funders);
  const [state, setState] = useState<"typing" | "saving" | "failed">("typing");

  const target: UploadTarget = {
    kind: "record",
    ref: { kind: "booking", id: booking.id, ...(chosenId ? { partId: chosenId } : {}) },
    recordName: booking.name,
    ...(booking.parts.length > 0 ? { partName: part.name } : {}),
  };
  const { connection } = useSession();
  const inDemo = demo ?? connection === "demo";
  const queue = useUploadQueue(target, uploadDeps, inDemo);
  const { items } = useUploads(queue);

  useEffect(() => {
    alive.current = true;
    const live = alive;
    return () => {
      live.current = false;
    };
  }, []);

  const busy = state === "saving";
  const problem = amountProblem(text);
  const amount = problem ? null : (readAmount(text) ?? null);
  const preview = previewLine(leftOf(part), amount, problem !== null);
  const uploading = items.some((i) => i.status === "shrinking" || i.status === "uploading");
  const receiptFailed = items.some((i) => i.status === "failed");

  const refuse = (kind: NonNullable<typeof problem>, typed: string) => {
    setText(before.current === null ? "" : rp(before.current));
    setRefusal(amountMessage(kind, typed, before.current));
  };

  const leaveAmount = (typed: string) => {
    if (pressing.current) return;
    const kind = amountProblem(typed);
    if (kind) return refuse(kind, typed);
    const read = readAmount(typed);
    setText(read === null || read === undefined ? "" : rp(read));
  };

  function submit() {
    pressing.current = false;
    // Enter in the amount mustn't record past a receipt still uploading or failed (the button is held too).
    if (busy || inDemo || uploading || receiptFailed) return;
    const kind = amountProblem(text);
    if (kind) {
      refuse(kind, text);
      input.current?.focus();
      return;
    }
    const value = readAmount(text);
    if (!value) {
      input.current?.focus();
      return;
    }
    const receipt = items.find((i) => i.status === "done" && i.fileId);
    setText(rp(value));
    setRefusal(null);
    setState("saving");
    paymentId.current ??= makeId();
    let attempt: Promise<Undoable>;
    try {
      attempt = record(
        { amount: value, paidOn: isIsoDate(paidOn) ? paidOn : null, paidBy: funderOfValue(paidBy), receiptFileId: receipt?.fileId ?? null },
        { partId: chosenId, paymentId: paymentId.current },
      );
    } catch (error) {
      attempt = Promise.reject(error);
    }
    attempt.then(
      ({ undo }) => {
        sheet.close();
        toast.undoable(
          recordedText(value, booking.name),
          undo,
          (partner) => paymentConflict(partner, booking.name),
          paymentConflictOwn(booking.name),
        );
      },
      () => {
        if (alive.current) setState("failed");
      },
    );
  }

  const subId = `${field}-after`;
  const refusalId = `${field}-refusal`;

  return (
    <Sheet title={PAYMENT_TITLE} sub={paymentSub(booking, part)}>
      <BigInput
        ref={input}
        id={`${field}-amount`}
        label="Amount paid"
        text={text}
        autoFocus
        invalid={problem !== null || refusal !== null}
        aria-describedby={refusal ? `${subId} ${refusalId}` : subId}
        onFocus={() => {
          before.current = problem ? null : (readAmount(text) ?? null);
        }}
        onText={(next) => {
          setText(next);
          if (!amountProblem(next)) setRefusal(null);
          if (state === "failed") setState("typing");
        }}
        onLeave={leaveAmount}
        onEnter={submit}
      />
      {refusal && (
        <p className={styles.refusal} id={refusalId} role="alert">
          {refusal}
        </p>
      )}
      <p className={`${styles.after} ${preview.attention ? styles.attention : ""}`} id={subId} aria-live="polite">
        {preview.text}
      </p>
      <Fields>
        <FieldRow label="Paid on">
          <DateInput value={paidOn} onChange={setPaidOn} disabled={busy} />
        </FieldRow>
        <FieldRow label="Paid by" group>
          <ChipGroup label="Paid by" options={paidByChoices(funders)} value={paidBy} onChange={setPaidBy} disabled={busy} />
        </FieldRow>
        <FieldRow label="Receipt" group>
          <div className={styles.receipt}>
            <TextLink disabled={busy} onClick={() => sheets.open(<UploadSheet queue={queue} />)}>
              Attach a receipt
            </TextLink>
            {items.length > 0 && (
              <ul className={styles.receipts} aria-label="Receipts">
                {items.map((item) => {
                  const view = statusView(item, true);
                  return (
                    <li key={item.id}>
                      <span className={styles.receiptName} dir="auto">
                        {item.name}
                      </span>
                      <span
                        className={`${styles.receiptStatus} ${view.tone === "ok" ? styles.ok : view.tone === "bad" ? styles.bad : ""}`}
                      >
                        {view.text}
                      </span>
                      {view.retry && (
                        <TextLink tone="rose" onClick={() => queue.retry(item.id)}>
                          Try again
                        </TextLink>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {(uploading || receiptFailed) && (
              <p className={`${styles.receiptNote} ${receiptFailed && !uploading ? styles.bad : ""}`} role="status">
                {uploading ? RECEIPT_WAITING : RECEIPT_FAILED}
              </p>
            )}
          </div>
        </FieldRow>
      </Fields>
      {state === "failed" && (
        <div className={styles.failure} role="alert">
          <Banner tone="rose" inline>
            {RECORD_FAILED}
          </Banner>
        </div>
      )}
      <div
        onPointerDownCapture={() => {
          pressing.current = true;
        }}
        onPointerUp={() => setTimeout(() => (pressing.current = false), 0)}
        onPointerCancel={() => (pressing.current = false)}
      >
        <CreateSheetActions
          action={state === "failed" ? "Try again" : PAYMENT_ACTION}
          busyLabel={PAYMENT_BUSY}
          busy={busy}
          demo={inDemo}
          demoLine={DEMO_RECORDING}
          disabled={uploading || receiptFailed}
          onAction={submit}
        />
      </div>
    </Sheet>
  );
}
