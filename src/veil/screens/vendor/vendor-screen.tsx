"use client";

import { useRouter } from "next/navigation";
import { useOnline } from "@/lib/data/session";
import { offlineOr } from "@/lib/model/save-state";
import { useRef, useState, type ReactNode } from "react";
import { bookingIdOf } from "@/lib/data/bookings";
import { useRemovedByPartner } from "@/lib/data/partner";
import { copyToShortlist } from "@/lib/data/shortlist";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { useToday } from "@/lib/data/use-today";
import { useUploadQueue } from "@/lib/data/uploads";
import {
  leanTowards,
  removePriceOption,
  removeVendorFromList,
  setVendorField,
  setVendorKeen,
  setVendorStage,
  useVendor,
  type VendorPage,
} from "@/lib/data/vendors";
import { newId } from "@/lib/data/write";
import { dec, n0 } from "@/lib/model/format";
import {
  BOOKING_LINE,
  BOOKING_LINE_LATER,
  COPY_FAILED,
  COPY_NOTE,
  NOT_HERE,
  NO_OPTIONS,
  NO_PRICE_HINT,
  NO_PRICE_KICKER,
  ON_SHORTLIST,
  ON_SHORTLIST_NOTE,
  OPEN_BOOKING,
  REMOVED_NOTE,
  REMOVE_ACTION,
  SEE_ALL,
  bookingToast,
  copiedToast,
  filesCount,
  heroFigure,
  leaningKicker,
  narrowingTitle,
  optionName,
  optionRemoveBody,
  optionRemoveTitle,
  optionRemovedToast,
  pricesCount,
  readRating,
  readReviewers,
  ratingMessage,
  removeVendorBody,
  removeVendorTitle,
  removedByPartner,
  removedTitle,
  removedToast,
  reviewersMessage,
  type PriceOptionView,
  type VendorDetail,
} from "@/lib/model/vendor-detail";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { FieldInput, FieldRow, Fields, FieldSelect } from "@/veil/parts/fields/fields";
import { NumberInput } from "@/veil/parts/fields/number";
import { Notes } from "@/veil/parts/fields/notes";
import { SaveLine, SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import { FileTiles } from "@/veil/parts/files/file-tiles";
import { Context, Figure, Hero, Kicker } from "@/veil/parts/hero/hero";
import { KeenHeart } from "@/veil/parts/keen/keen-heart";
import { keenFailed, keenToast } from "@/veil/parts/keen/keen-text";
import { MenuCardList } from "@/veil/parts/menu-card/menu-card-list";
import { Message } from "@/veil/parts/message/message";
import { StageChips } from "@/veil/parts/stage/stage-chips";
import { WhatsAppLink } from "@/veil/parts/whatsapp/whatsapp-link";
import { veilHref } from "@/veil/href";
import { BackLink } from "@/veil/shell/back-link";
import { useConfirm } from "@/veil/shell/confirm";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import { AddPriceOptionSheet, EditPriceOptionSheet } from "./price-option-sheet";
import styles from "./vendor-screen.module.css";

const VENDORS = "/vendors";

/**
 * A vendor (guide §5.12, F7–F11, F13, F16, B1, N10): the hero with the keen
 * heart, stage and the option we're leaning towards, the contact and reputation
 * rows, the price options, notes, files, and the shortlist card. Every change
 * saves as you go and the save line under the title says where it stands.
 */
export function VendorScreen({ vendorId }: { vendorId: string }) {
  const read = useVendor(vendorId);
  const toast = useToast();
  const partner = useRemovedByPartner({ kind: "vendor", id: vendorId });
  // Set when this screen removed the vendor: the screen says so in place (guide §5.12) until it is undone.
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
      <BackLink path={VENDORS} label="Vendors" />
      <Message kind={kind} title={title} actions={<Btn href={veilHref(VENDORS)}>{SEE_ALL}</Btn>}>
        {body}
      </Message>
    </>
  );

  return (
    <PageColumn>
      <ScreenState read={read} what="this vendor" onRetry={() => window.location.reload()}>
        {(data) => {
          if (data?.vendor) return <VendorBody page={data} vendor={data.vendor} onRemoved={onRemoved} />;
          if (read.status === "demo") {
            return gone("nothing-yet", "No vendors in demonstration mode", "The planner isn’t connected to its database yet.");
          }
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

function VendorBody(props: { page: VendorPage; vendor: VendorDetail; onRemoved: (name: string, undo: () => Promise<void>) => void }) {
  return (
    <SaveScopeProvider>
      <Detail {...props} />
    </SaveScopeProvider>
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

/** A change that didn't save, under what was changed: the choice stays and Try again is one press. */
function Failure({ name, retry }: { name: string; retry: () => void }) {
  const offline = !useOnline();
  return (
    <p className={styles.failure} role="alert">
      {offlineOr(keenFailed(name), offline)}{" "}
      <TextLink tone="rose" onClick={retry}>
        Try again
      </TextLink>
    </p>
  );
}

function Detail({
  page,
  vendor,
  onRemoved,
}: {
  page: VendorPage;
  vendor: VendorDetail;
  onRemoved: (name: string, undo: () => Promise<void>) => void;
}) {
  const toast = useToast();
  const sheets = useSheets();
  const confirm = useConfirm();
  const router = useRouter();
  const today = useToday();
  const { id, name } = vendor;
  const bookingHref = veilHref(`/budget/bookings/${bookingIdOf({ kind: "vendor", id })}`);

  const queue = useUploadQueue({ kind: "record", ref: { kind: "vendor", id }, recordName: name });

  const keen = useAutosaveField<boolean>({
    value: vendor.keen,
    save: async (next) => {
      await setVendorKeen(id, next);
      toast.confirmation(keenToast(name, next));
    },
  });
  const stage = useAutosaveField<string>({
    value: vendor.stage,
    save: async (next) => {
      const { becameBooking } = await setVendorStage(id, next, today);
      if (becameBooking) toast.next(bookingToast(name), "Open", () => router.push(bookingHref));
    },
  });
  const lean = useAutosaveField<string | null>({
    value: vendor.leaningId,
    save: (optionId) => leanTowards(id, optionId as string),
  });
  const contact = useAutosaveField({
    value: vendor.contactName,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setVendorField(id, "contactName", next),
  });
  const phone = useAutosaveField({
    value: vendor.contactPhone,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setVendorField(id, "contactPhone", next),
  });
  const category = useAutosaveField({
    value: vendor.category,
    save: (next: string) => setVendorField(id, "category", next),
  });
  const rating = useAutosaveField<number | null>({
    value: vendor.rating,
    save: (next) => setVendorField(id, "rating", next),
  });
  const reviewers = useAutosaveField<number | null>({
    value: vendor.reviewers,
    save: (next) => setVendorField(id, "reviewers", next),
  });
  const notes = useAutosaveField({ value: vendor.notes, save: (next: string) => setVendorField(id, "notes", next) });

  // The shortlist card: one copy, made once however many times Try again is pressed.
  const [copying, setCopying] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const offline = !useOnline();
  const finalistId = useRef<string | null>(null);

  async function copy() {
    if (copying) return;
    setCopying(true);
    setCopyFailed(false);
    finalistId.current ??= newId("shortlist");
    try {
      const copied = await copyToShortlist(id, { finalistId: finalistId.current });
      if (copied.created) toast.undoable(copiedToast(name), copied.undo);
      finalistId.current = null;
    } catch {
      setCopyFailed(true);
    }
    setCopying(false);
  }

  const optionViews = vendor.options.map((o) => ({
    id: o.id,
    name: optionName(o),
    price: o.price,
    includes: o.includes,
    preferred: o.id === lean.draft,
  }));

  async function removeOption(option: { id: string }) {
    const view = vendor.options.find((o) => o.id === option.id);
    if (!view) return;
    const removed: { undo?: () => Promise<void> } = {};
    const done = await confirm({
      title: optionRemoveTitle(optionName(view)),
      body: optionRemoveBody(view.price, view.leaning),
      action: "Remove option",
      danger: true,
      run: async () => {
        removed.undo = (await removePriceOption(id, view.id)).undo;
      },
    });
    if (done && removed.undo) toast.undoable(optionRemovedToast(optionName(view)), removed.undo);
  }

  async function removeVendor() {
    const removed: { undo?: () => Promise<void> } = {};
    await confirm({
      title: removeVendorTitle(name),
      body: removeVendorBody({
        name,
        optionCount: vendor.options.length,
        hasNotes: Boolean(vendor.notes.trim()),
        fileCount: vendor.files.length,
        onShortlist: vendor.finalistId !== null,
        booked: vendor.booked,
      }),
      action: REMOVE_ACTION,
      danger: true,
      run: async () => {
        removed.undo = (await removeVendorFromList(id)).undo;
        // The vendor leaves the data in the same moment, so the screen is told before it can say "not here".
        onRemoved(name, removed.undo);
      },
    });
  }

  const figure = heroFigure({ options: vendor.options });
  const bookingLine = vendor.booked
    ? ["Chosen", "Done"].includes(stage.draft)
      ? BOOKING_LINE
      : BOOKING_LINE_LATER
    : null;

  return (
    <>
      <BackLink path={VENDORS} label="Vendors" />
      <Hero
        category={vendor.category}
        title={
          <>
            <span className={vendor.ruledOut ? styles.ruled : undefined}>{name}</span>{" "}
            <span className={styles.heart}>
              <KeenHeart name={name} keen={keen.draft} disabled={keen.disabled} onToggle={keen.commit} />
            </span>
          </>
        }
        nav={
          <>
            <SaveLine />
            <StageChips
              kind="vendor"
              stage={stage.draft}
              disabled={stage.disabled}
              className={styles.stage}
              onChange={stage.commit}
            />
            {keen.failed && <Failure name={name} retry={keen.retry} />}
            {stage.failed && <Failure name={name} retry={stage.retry} />}
            {bookingLine && (
              <p className={styles.origin}>
                {bookingLine} <TextLink href={bookingHref}>{OPEN_BOOKING}</TextLink>
              </p>
            )}
          </>
        }
      >
        {figure.kind === "leaning" ? (
          <>
            <Kicker>{leaningKicker(figure.name)}</Kicker>
            <Figure amount={figure.price} md />
          </>
        ) : (
          <>
            <Kicker>{NO_PRICE_KICKER}</Kicker>
            <Context>{NO_PRICE_HINT}</Context>
          </>
        )}
      </Hero>

      <SectionHeading>Contact and reputation</SectionHeading>
      <Fields>
        <FieldRow label="Contact person" field={contact}>
          <FieldInput {...contact.bind} placeholder="Who you talk to" />
        </FieldRow>
        <FieldRow label="Phone" field={phone}>
          <div className={styles.phone}>
            <FieldInput {...phone.bind} type="tel" placeholder="0812 3456 7890" />
            <WhatsAppLink phone={phone.draft} variant="detail" />
          </div>
        </FieldRow>
        <FieldRow label="Category" field={category}>
          <FieldSelect {...category.bind} options={page.categories.map((c) => ({ value: c, label: c }))} />
        </FieldRow>
        <FieldRow label="Review rating" field={rating} hint="Out of 5, from their public reviews">
          <NumberInput
            {...rating.bind}
            placeholder="For example, 4,8"
            show={dec}
            read={readRating}
            say={ratingMessage}
          />
        </FieldRow>
        <FieldRow label="Number of reviewers" field={reviewers}>
          <NumberInput
            {...reviewers.bind}
            inputMode="numeric"
            placeholder="How many people reviewed them"
            show={n0}
            read={readReviewers}
            say={reviewersMessage}
          />
        </FieldRow>
      </Fields>

      <SectionHeading small={pricesCount(vendor.options.length)}>Prices</SectionHeading>
      {vendor.options.length ? (
        <MenuCardList
          options={optionViews}
          onLean={(option) => lean.commit(option.id)}
          onEdit={(option) => {
            const view = vendor.options.find((o) => o.id === option.id) as PriceOptionView;
            sheets.open(<EditPriceOptionSheet vendorId={id} vendorName={name} option={view} />);
          }}
          onRemove={(option) => void removeOption(option)}
        />
      ) : (
        <p className={styles.note}>{NO_OPTIONS}</p>
      )}
      {lean.failed && <Failure name={name} retry={lean.retry} />}
      <p className={styles.add}>
        <Btn
          variant="quiet"
          small
          onClick={() =>
            sheets.open(<AddPriceOptionSheet vendorId={id} vendorName={name} first={vendor.options.length === 0} />)
          }
        >
          Add a price option
        </Btn>
      </p>

      <Notes {...notes.bind} field={notes} />

      <SectionHeading small={filesCount(vendor.files.length)}>Files</SectionHeading>
      <FileTiles
        files={vendor.files.map((f) => ({ id: f.id, name: f.name, url: f.url, size: f.size, mime: f.mime }))}
        queue={queue}
      />

      <section className={styles.card}>
        {vendor.finalistId ? (
          <>
            <h2 className={styles.cardTitle}>{ON_SHORTLIST}</h2>
            <p className={styles.cardNote}>{ON_SHORTLIST_NOTE}</p>
            <p className={styles.cardActs}>
              <Btn variant="quiet" href={veilHref(`/vendors/shortlist/${vendor.finalistId}`)}>
                Open on the shortlist
              </Btn>
            </p>
          </>
        ) : (
          <>
            <h2 className={styles.cardTitle} dir="auto">
              {narrowingTitle(vendor.category)}
            </h2>
            <p className={styles.cardNote}>{COPY_NOTE}</p>
            {copyFailed && (
              <p className={styles.failure} role="alert">
                {offlineOr(COPY_FAILED, offline)}
              </p>
            )}
            <p className={styles.cardActs}>
              <Btn busy={copying} busyLabel="Copying" onClick={() => void copy()}>
                {copyFailed ? "Try again" : "Copy to the shortlist"}
              </Btn>
            </p>
          </>
        )}
      </section>

      <div className={styles.danger}>
        <TextLink tone="rose" onClick={() => void removeVendor()}>
          Remove this vendor
        </TextLink>
      </div>
    </>
  );
}
