"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useOnline } from "@/lib/data/session";
import { offlineOr } from "@/lib/model/save-state";
import { addPart, removeBooking, removePart, splitBooking, type RecordTarget } from "@/lib/data/bookings";
import { setBookingField, setPartField } from "@/lib/data/booking-fields";
import { useRemovedByPartner } from "@/lib/data/partner";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { useBooking, type BookingFile, type BookingPage } from "@/lib/data/use-booking";
import { useUploadQueue } from "@/lib/data/uploads";
import type { Booking, Part } from "@/lib/model/bookings";
import {
  ACTION_FAILED,
  ADD_PART,
  DEMO_NONE,
  ESTIMATE_HINT,
  NEXT_STEP_PLACEHOLDER,
  NOT_HERE,
  NO_ESTIMATE,
  PAID_PART_HINT,
  PARTS_SMALL,
  PARTS_SMALL_SINGLE,
  REMOVED_NOTE,
  REMOVE_BOOKING,
  REMOVE_BOOKING_ACTION,
  REMOVE_PART_ACTION,
  SEE_ALL,
  SPLIT_ACTION,
  SPLIT_NOTE,
  STATIC_PARTS,
  bookingFigures,
  estimateSentence,
  estimateTail,
  filesHeading,
  nextDue,
  originLine,
  removeBookingBody,
  removeBookingTitle,
  removePartBody,
  removePartTitle,
  removedByPartner,
  removedTitle,
  removedToast,
  splitConflict,
  splitToast,
} from "@/lib/model/booking-detail";
import { rp } from "@/lib/model/format";
import { leftOf, splitPlan } from "@/lib/model/money";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { DateInput, FieldInput, FieldRow, Fields, FieldSelect, StaticValue } from "@/veil/parts/fields/fields";
import { MoneyInput } from "@/veil/parts/fields/money";
import { SaveLine, SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import { FileTiles } from "@/veil/parts/files/file-tiles";
import { Context, Figure, Hero, Kicker } from "@/veil/parts/hero/hero";
import { Thread } from "@/veil/parts/hero/thread";
import { PartDisclosure } from "@/veil/parts/menu-card/part-disclosure";
import { Message } from "@/veil/parts/message/message";
import { NextCard } from "@/veil/parts/next-card/next-card";
import { useRecordPayment } from "@/veil/parts/payment/use-record-payment";
import { funderName } from "@/veil/parts/rows/ledger-text";
import { veilHref } from "@/veil/href";
import { BackLink } from "@/veil/shell/back-link";
import { useConfirm } from "@/veil/shell/confirm";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useToast } from "@/veil/shell/toasts";
import styles from "./booking-screen.module.css";

const BOOKINGS = "/budget/bookings";

/**
 * A booking (guide §5.6, B1, B3, B4, B12): the hero with the save line, the
 * figure, thread and next step, the origin line, the details, the parts with
 * their own fields, files and actions, the files, and Remove this booking.
 * Every change saves as you go and the save line says where it stands.
 */
export function BookingScreen({ bookingId }: { bookingId: string }) {
  const read = useBooking(bookingId);
  const toast = useToast();
  const partner = useRemovedByPartner({ kind: "booking", id: bookingId });
  // Set when this screen removed the booking: it says so in place (guide §5.6) until it is undone.
  const [removed, setRemoved] = useState<string | null>(null);

  function onRemoved(name: string, undo: () => Promise<void>) {
    setRemoved(name);
    toast.undoable(removedToast(name), async () => {
      await undo();
      setRemoved(null);
    });
  }

  const gone = (kind: "nothing-yet" | "gone", title: string, body: string) => (
    <>
      <BackLink path={BOOKINGS} label="Bookings" />
      <Message kind={kind} title={title} actions={<Btn href={veilHref(BOOKINGS)}>{SEE_ALL}</Btn>}>
        {body}
      </Message>
    </>
  );

  return (
    <PageColumn>
      <ScreenState read={read} what="this booking" onRetry={() => window.location.reload()}>
        {(page) => {
          if (page?.booking) {
            return (
              <SaveScopeProvider>
                <Detail bookingId={bookingId} page={page} booking={page.booking} onRemoved={onRemoved} />
              </SaveScopeProvider>
            );
          }
          if (read.status === "demo") return gone("nothing-yet", DEMO_NONE.title, DEMO_NONE.body);
          if (removed) return gone("gone", removedTitle(removed), REMOVED_NOTE);
          if (partner) {
            const said = removedByPartner(partner.by);
            return gone("gone", said.title, said.body);
          }
          return gone("gone", NOT_HERE.title, NOT_HERE.body);
        }}
      </ScreenState>
    </PageColumn>
  );
}

function SectionHeading({ small, children }: { small?: string; children: ReactNode }) {
  return (
    <h2 className={styles.section}>
      <span>{children}</span>
      {small ? <small>{small}</small> : null}
    </h2>
  );
}

const toTiles = (files: BookingFile[]) =>
  files.map((f) => ({ id: f.id, name: f.name, url: f.url, size: f.size, mime: f.mime, fromVendor: f.fromVendor }));

function Detail({
  bookingId,
  page,
  booking,
  onRemoved,
}: {
  bookingId: string;
  page: BookingPage;
  booking: Booking;
  onRemoved: (name: string, undo: () => Promise<void>) => void;
}) {
  const toast = useToast();
  const offline = !useOnline();
  const confirm = useConfirm();
  const record = useRecordPayment();
  const { today, funders } = page;
  const target: RecordTarget = { kind: booking.kind, id: booking.recordId };
  const inParts = booking.parts.length > 0;
  // The parts as they are now, for a split's Undo that finds one changed since.
  const partsNow = useRef<readonly Part[]>(booking.parts);
  useEffect(() => {
    partsNow.current = booking.parts;
  }, [booking.parts]);
  const figures = bookingFigures(booking);
  const next = nextDue(booking, today);
  const sentence = estimateSentence(booking);
  const tail = sentence ? estimateTail(sentence) : null;

  const queue = useUploadQueue({ kind: "record", ref: { kind: "booking", id: bookingId }, recordName: booking.name });

  const funderOptions = [
    ...funders.map((f) => ({ value: f.id, label: f.name })),
    { value: "", label: "Not assigned" },
  ];
  const knownFunder = (id: string | null) => (id !== null && funders.some((f) => f.id === id) ? id : "");

  const name = useAutosaveField({
    value: booking.name,
    required: true,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setBookingField(target, "name", next),
  });
  const category = useAutosaveField({
    value: booking.category,
    save: (next: string) => setBookingField(target, "category", next),
  });
  const price = useAutosaveField<number | null>({
    value: booking.price,
    save: (next) => setBookingField(target, "price", next ?? 0),
  });
  const estimate = useAutosaveField<number | null>({
    value: booking.estimate,
    save: (next) => setBookingField(target, "estimate", next),
  });
  const paid = useAutosaveField<number | null>({
    value: booking.paid,
    save: (next) => setBookingField(target, "paid", next ?? 0),
  });
  const funder = useAutosaveField({
    value: knownFunder(booking.funder),
    save: (next: string) => setBookingField(target, "funder", next || null),
  });
  const due = useAutosaveField({
    value: booking.due ?? "",
    save: (next: string) => setBookingField(target, "due", next || null),
  });
  const step = useAutosaveField({
    value: booking.step,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setBookingField(target, "step", next),
  });

  // Which parts are open, and the one whose name should take focus once it arrives (a part just added).
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [focusPart, setFocusPart] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  const show = (id: string) => setOpen((current) => new Set(current).add(id));

  async function split() {
    if (splitting) return;
    setSplitting(true);
    setActionFailed(false);
    try {
      const before = booking;
      const done = await splitBooking(target);
      const last = done.partIds.at(-1);
      if (last) show(last);
      // The parts as the split made them, against the parts when Undo finds a change since (N13, P5-S3).
      let n = 0;
      const made = splitPlan(before, () => done.partIds[n++] ?? "");
      toast.undoable(
        splitToast(done.partIds.length),
        done.undo,
        (partner) => splitConflict(partner, made, partsNow.current),
        () => splitConflict(null, made, partsNow.current),
      );
    } catch {
      setActionFailed(true);
    }
    setSplitting(false);
  }

  async function add() {
    if (adding) return;
    setAdding(true);
    setActionFailed(false);
    try {
      const done = await addPart(target);
      show(done.partId);
      setFocusPart(done.partId);
    } catch {
      setActionFailed(true);
    }
    setAdding(false);
  }

  async function removeThisPart(part: Part) {
    const removedPart: { undo?: () => Promise<void> } = {};
    const done = await confirm({
      title: removePartTitle(part.name),
      body: removePartBody(part),
      action: REMOVE_PART_ACTION,
      danger: true,
      run: async () => {
        removedPart.undo = (await removePart(target, part.id as string)).undo;
      },
    });
    if (done && removedPart.undo) toast.undoable(removedToast(part.name), removedPart.undo);
  }

  async function removeThisBooking() {
    await confirm({
      title: removeBookingTitle(booking.name),
      body: removeBookingBody(booking, page.files.length),
      action: REMOVE_BOOKING_ACTION,
      danger: true,
      run: async () => {
        const { undo } = await removeBooking(target);
        // The booking leaves the data in the same moment, so the screen is told before it can say "not here".
        onRemoved(booking.name, undo);
      },
    });
  }

  return (
    <>
      <BackLink path={BOOKINGS} label="Bookings" />
      <Hero category={booking.category || "No category"} title={booking.name} nav={<SaveLine />}>
        <Kicker>{figures.kicker}</Kicker>
        <Figure amount={figures.amount} tone={figures.tone} md />
        <Context>
          {figures.over ? (
            <>
              <b className="num">{rp(figures.paid)}</b> paid against a price of <b className="num">{rp(figures.price)}</b>.
              Check whether the price or a payment is wrong.
            </>
          ) : (
            <>
              of <b className="num">{rp(figures.price)}</b>, with <b className="num">{rp(figures.paid)}</b> paid
            </>
          )}
        </Context>
        <Thread fill={figures.pct} over={figures.over} ends={figures.ends} label={figures.label} />
        {next && (
          <NextCard
            onBooking
            today={today}
            next={next}
            lateCount={0}
            funders={funders}
            onRecord={() => record(booking, inParts ? next.part.id : null)}
          />
        )}
        <p className={styles.origin}>{originLine(booking, today)}</p>
      </Hero>

      <SectionHeading>Details</SectionHeading>
      <Fields>
        <FieldRow label="Name" field={name}>
          <FieldInput {...name.bind} />
        </FieldRow>
        <FieldRow label="Category" field={category} group={booking.kind === "venue"}>
          {booking.kind === "venue" ? (
            <StaticValue>Venue</StaticValue>
          ) : (
            <FieldSelect {...category.bind} options={page.categories.map((c) => ({ value: c, label: c }))} />
          )}
        </FieldRow>
        {inParts ? (
          <FieldRow label="Price" group>
            <StaticValue>
              {rp(figures.price)} <span className={styles.from}>{STATIC_PARTS(booking.parts.length)}</span>
            </StaticValue>
          </FieldRow>
        ) : (
          <FieldRow label="Agreed price" field={price}>
            <MoneyInput {...price.bind} />
          </FieldRow>
        )}
        <FieldRow label="Estimate" field={estimate} hint={ESTIMATE_HINT}>
          <MoneyInput {...estimate.bind} placeholder={NO_ESTIMATE} />
        </FieldRow>
        {!inParts && (
          <>
            <FieldRow label="Paid so far" field={paid}>
              <MoneyInput {...paid.bind} />
            </FieldRow>
            <FieldRow label="Funder" field={funder}>
              <FieldSelect {...funder.bind} options={funderOptions} />
            </FieldRow>
            <FieldRow label="Due date" field={due}>
              <DateInput {...due.bind} />
            </FieldRow>
            <FieldRow label="Next step" field={step}>
              <FieldInput {...step.bind} placeholder={NEXT_STEP_PLACEHOLDER} />
            </FieldRow>
          </>
        )}
      </Fields>
      {sentence && tail && (
        <p className={styles.note}>
          You estimated <b className="num">{rp(sentence.estimate)}</b> while comparing.{" "}
          {tail.same ? (
            "Exactly the agreed price."
          ) : (
            <>
              The agreed price is <b className="num">{tail.amount}</b> {tail.word}.
            </>
          )}
        </p>
      )}

      <SectionHeading small={inParts ? PARTS_SMALL(booking.parts.length) : PARTS_SMALL_SINGLE}>Parts</SectionHeading>
      {inParts ? (
        <>
          <ul className={styles.parts}>
            {booking.parts.map((part) => (
              <PartRow
                key={part.id}
                target={target}
                booking={booking}
                bookingId={bookingId}
                part={part}
                today={today}
                funders={funders}
                funderOptions={funderOptions}
                files={page.partFiles[part.id as string] ?? []}
                open={open.has(part.id as string)}
                onToggle={(isOpen) =>
                  setOpen((current) => {
                    const rest = new Set(current);
                    if (isOpen) rest.add(part.id as string);
                    else rest.delete(part.id as string);
                    return rest;
                  })
                }
                focus={focusPart === part.id}
                onFocused={() => setFocusPart(null)}
                onPay={() => record(booking, part.id)}
                onRemove={() => void removeThisPart(part)}
              />
            ))}
          </ul>
          <p className={styles.add}>
            <Btn variant="quiet" small busy={adding} busyLabel="Adding" onClick={() => void add()}>
              {ADD_PART}
            </Btn>
          </p>
        </>
      ) : (
        <>
          <p className={styles.note}>{SPLIT_NOTE}</p>
          <p className={styles.add}>
            <Btn variant="quiet" small busy={splitting} busyLabel="Splitting" onClick={() => void split()}>
              {SPLIT_ACTION}
            </Btn>
          </p>
        </>
      )}
      {actionFailed && (
        <p className={styles.failure} role="alert">
          {offlineOr(ACTION_FAILED, offline)}
        </p>
      )}

      <SectionHeading small={filesHeading(page.files.length)}>Files</SectionHeading>
      <FileTiles files={toTiles(page.files)} queue={queue} />

      <div className={styles.danger}>
        <TextLink tone="rose" onClick={() => void removeThisBooking()}>
          {REMOVE_BOOKING}
        </TextLink>
      </div>
    </>
  );
}

interface PartRowProps {
  target: RecordTarget;
  booking: Booking;
  bookingId: string;
  part: Part;
  today: string;
  funders: BookingPage["funders"];
  funderOptions: { value: string; label: string }[];
  files: BookingFile[];
  open: boolean;
  onToggle: (open: boolean) => void;
  /** A part just added: its name takes focus once, when it arrives. */
  focus: boolean;
  onFocused: () => void;
  onPay: () => void;
  onRemove: () => void;
}

/** One part (guide §5.6): its summary, and its own fields, files and actions when it opens. */
function PartRow({
  target,
  booking,
  bookingId,
  part,
  today,
  funders,
  funderOptions,
  files,
  open,
  onToggle,
  focus,
  onFocused,
  onPay,
  onRemove,
}: PartRowProps) {
  const partId = part.id as string;
  const nameInput = useRef<HTMLInputElement>(null);
  const queue = useUploadQueue({
    kind: "record",
    ref: { kind: "booking", id: bookingId, partId },
    recordName: booking.name,
    partName: part.name,
  });

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
    save: (next: string) => setPartField(target, partId, "name", next),
  });
  const price = useAutosaveField<number | null>({
    value: part.price,
    save: (next) => setPartField(target, partId, "price", next ?? 0),
  });
  const paid = useAutosaveField<number | null>({
    value: part.paid,
    save: (next) => setPartField(target, partId, "paid", next ?? 0),
  });
  const funder = useAutosaveField({
    value: funders.some((f) => f.id === part.funder) ? (part.funder as string) : "",
    save: (next: string) => setPartField(target, partId, "funder", next || null),
  });
  const due = useAutosaveField({
    value: part.due ?? "",
    save: (next: string) => setPartField(target, partId, "due", next || null),
  });
  const step = useAutosaveField({
    value: part.step,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setPartField(target, partId, "step", next),
  });

  const owing = leftOf(part) > 0;
  return (
    <PartDisclosure
      part={part}
      today={today}
      funder={funderName(funders, part.funder)}
      defaultOpen={open}
      onToggle={onToggle}
    >
      <Fields>
        <FieldRow label="Name" field={name}>
          <FieldInput {...name.bind} ref={nameInput} />
        </FieldRow>
        <FieldRow label="Price" field={price}>
          <MoneyInput {...price.bind} />
        </FieldRow>
        <FieldRow label="Paid so far" field={paid}>
          <MoneyInput {...paid.bind} />
        </FieldRow>
        <FieldRow label="Funder" field={funder}>
          <FieldSelect {...funder.bind} options={funderOptions} />
        </FieldRow>
        <FieldRow label="Due date" field={due} hint={owing ? undefined : PAID_PART_HINT}>
          <DateInput {...due.bind} />
        </FieldRow>
        <FieldRow label="Next step" field={step}>
          <FieldInput {...step.bind} placeholder={NEXT_STEP_PLACEHOLDER} />
        </FieldRow>
        <FieldRow label="Files" group>
          <FileTiles files={toTiles(files)} queue={queue} />
        </FieldRow>
        <FieldRow label="Actions" group hideLabel>
          <div className={styles.acts}>
            {owing && <TextLink onClick={onPay}>Record a payment</TextLink>}
            <TextLink tone="rose" onClick={onRemove}>
              Remove this part
            </TextLink>
          </div>
        </FieldRow>
      </Fields>
    </PartDisclosure>
  );
}
