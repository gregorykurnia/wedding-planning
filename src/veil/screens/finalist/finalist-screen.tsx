"use client";

import { useRouter } from "next/navigation";
import { useOnline } from "@/lib/data/session";
import { offlineOr } from "@/lib/model/save-state";
import { useState, type ReactNode } from "react";
import { useRemovedByPartner } from "@/lib/data/partner";
import {
  leanTowardsPackage,
  removeFinalist,
  removePackage,
  setFinalistField,
  useFinalist,
} from "@/lib/data/shortlist";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { useUploadQueue } from "@/lib/data/uploads";
import { n0 } from "@/lib/model/format";
import {
  ADDED_STRAIGHT,
  CHOSEN_TITLE,
  COPIED_AFTER,
  COPIED_BEFORE,
  COPIED_GONE,
  DEMO_NONE,
  NOT_HERE,
  NO_PACKAGES,
  NO_PACKAGE_KICKER,
  REMOVE_ACTION,
  SEE_SHORTLIST,
  chosenNote,
  filesFromVendor,
  followersMessage,
  packageMeta,
  packageName,
  packageRemoveBody,
  packageRemoveTitle,
  packageRemovedToast,
  packagesCount,
  readCount,
  removeFinalistBody,
  removeFinalistTitle,
  removedByPartner,
  removedTitle,
  removedToast,
  reviewsMessage,
  type FinalistDetail,
} from "@/lib/model/finalist-detail";
import { keenFailed } from "@/veil/parts/keen/keen-text";
import { filesCount, leaningKicker, OPEN_BOOKING } from "@/lib/model/vendor-detail";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { FieldInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { Notes } from "@/veil/parts/fields/notes";
import { NumberInput } from "@/veil/parts/fields/number";
import { SaveLine, SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import { FileTiles } from "@/veil/parts/files/file-tiles";
import { Figure, Hero, Kicker } from "@/veil/parts/hero/hero";
import { MenuCardList } from "@/veil/parts/menu-card/menu-card-list";
import { Message } from "@/veil/parts/message/message";
import { WhatsAppLink } from "@/veil/parts/whatsapp/whatsapp-link";
import { veilHref } from "@/veil/href";
import { BackLink } from "@/veil/shell/back-link";
import { useConfirm } from "@/veil/shell/confirm";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import { BOOKED_FLAG } from "../shortlist/shortlist-text";
import { BookSheet, MoveSheet } from "./move-sheets";
import { AddPackageSheet, EditPackageSheet } from "./package-sheet";
import styles from "./finalist-screen.module.css";

const SHORTLIST = "/vendors/shortlist";

/**
 * A finalist (guide §5.14, F17, F18, F20, F24, B1, N10): the hero with where it
 * came from and the package we're leaning towards, the packages, contact and
 * popularity, notes, files (the vendor's too), and the card that books it or
 * moves it into Vendors. Every change saves as you go and the save line under
 * the title says where it stands.
 */
export function FinalistScreen({ finalistId }: { finalistId: string }) {
  const read = useFinalist(finalistId);
  const toast = useToast();
  const partner = useRemovedByPartner({ kind: "finalist", id: finalistId });
  // Set when this screen removed the finalist: the screen says so in place (guide §5.14) until it is undone.
  const [removed, setRemoved] = useState<string | null>(null);

  function onRemoved(name: string, undo: () => Promise<void>) {
    setRemoved(name);
    toast.undoable(removedToast(name), async () => {
      await undo();
      setRemoved(null);
    });
  }

  const gone = (kind: "nothing-yet" | "gone", title: string, body?: string) => (
    <>
      <BackLink path={SHORTLIST} label="Shortlist" />
      <Message kind={kind} title={title} actions={<Btn href={veilHref(SHORTLIST)}>{SEE_SHORTLIST}</Btn>}>
        {body}
      </Message>
    </>
  );

  return (
    <PageColumn>
      <ScreenState read={read} what="this finalist" onRetry={() => window.location.reload()}>
        {(data) => {
          if (data?.finalist) return <FinalistBody finalist={data.finalist} onRemoved={onRemoved} />;
          if (read.status === "demo") return gone("nothing-yet", DEMO_NONE);
          if (removed) return gone("gone", removedTitle(removed));
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

function FinalistBody(props: { finalist: FinalistDetail; onRemoved: (name: string, undo: () => Promise<void>) => void }) {
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
  finalist,
  onRemoved,
}: {
  finalist: FinalistDetail;
  onRemoved: (name: string, undo: () => Promise<void>) => void;
}) {
  const toast = useToast();
  const sheets = useSheets();
  const confirm = useConfirm();
  const router = useRouter();
  const { id, name } = finalist;
  const bookingHref = finalist.bookingId ? veilHref(`/budget/bookings/${finalist.bookingId}`) : null;
  const canMove = finalist.sourceVendor === null && !finalist.sourceGone;

  const queue = useUploadQueue({ kind: "record", ref: { kind: "finalist", id }, recordName: name });

  const lean = useAutosaveField<string | null>({
    value: finalist.leaningId,
    save: (packageId) => leanTowardsPackage(id, packageId as string),
  });
  const contact = useAutosaveField({
    value: finalist.contactName,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setFinalistField(id, "contactName", next),
  });
  const phone = useAutosaveField({
    value: finalist.contactPhone,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setFinalistField(id, "contactPhone", next),
  });
  const reviewers = useAutosaveField<number | null>({
    value: finalist.reviewers,
    save: (next) => setFinalistField(id, "reviewers", next),
  });
  const followers = useAutosaveField<number | null>({
    value: finalist.followers,
    save: (next) => setFinalistField(id, "followers", next),
  });
  const step = useAutosaveField({ value: finalist.step, save: (next: string) => setFinalistField(id, "step", next) });
  const notes = useAutosaveField({ value: finalist.notes, save: (next: string) => setFinalistField(id, "notes", next) });

  const options = finalist.packages.map((p) => ({
    id: p.id,
    name: packageName(p),
    price: p.price,
    includes: p.includes,
    meta: packageMeta(p),
    notes: p.notes,
    preferred: p.id === lean.draft,
  }));

  async function removeOne(option: { id: string }) {
    const view = finalist.packages.find((p) => p.id === option.id);
    if (!view) return;
    const removedPackage: { undo?: () => Promise<void> } = {};
    const done = await confirm({
      title: packageRemoveTitle(packageName(view)),
      body: packageRemoveBody(view.price),
      action: "Remove package",
      danger: true,
      run: async () => {
        removedPackage.undo = (await removePackage(id, view.id)).undo;
      },
    });
    if (done && removedPackage.undo) toast.undoable(packageRemovedToast(packageName(view)), removedPackage.undo);
  }

  async function removeFromShortlist() {
    const removedFinalist: { undo?: () => Promise<void> } = {};
    await confirm({
      title: removeFinalistTitle(name),
      body: removeFinalistBody({
        name,
        packageCount: finalist.packages.length,
        vendorName: finalist.sourceVendor?.name ?? null,
        fileCount: finalist.files.length,
        hasBooking: finalist.hasBooking,
      }),
      action: REMOVE_ACTION,
      danger: true,
      run: async () => {
        removedFinalist.undo = (await removeFinalist(id)).undo;
        // The finalist leaves the data in the same moment, so the screen is told before it can say "not here".
        onRemoved(name, removedFinalist.undo);
      },
    });
  }

  const leaning = finalist.packages.find((p) => p.leaning);

  return (
    <>
      <BackLink path={SHORTLIST} label="Shortlist" />
      <Hero
        category={finalist.category}
        title={name}
        nav={
          <>
            <SaveLine />
            <p className={styles.origin}>
              {finalist.sourceVendor ? (
                <>
                  {COPIED_BEFORE}{" "}
                  <TextLink href={veilHref(`/vendors/${finalist.sourceVendor.id}`)}>{finalist.sourceVendor.name}</TextLink>{" "}
                  {COPIED_AFTER}
                </>
              ) : finalist.sourceGone ? (
                COPIED_GONE
              ) : (
                ADDED_STRAIGHT
              )}
            </p>
            {finalist.booked && bookingHref && (
              <p className={styles.origin}>
                <span className={styles.flag}>{BOOKED_FLAG}</span> <TextLink href={bookingHref}>{OPEN_BOOKING}</TextLink>
              </p>
            )}
          </>
        }
      >
        {leaning ? (
          <>
            <Kicker>{leaningKicker(packageName(leaning))}</Kicker>
            <Figure amount={leaning.price} md />
          </>
        ) : (
          <Kicker>{NO_PACKAGE_KICKER}</Kicker>
        )}
      </Hero>

      <SectionHeading small={packagesCount(finalist.packages.length)}>Packages</SectionHeading>
      {options.length ? (
        <MenuCardList
          options={options}
          onLean={(option) => lean.commit(option.id)}
          onEdit={(option) => {
            const view = finalist.packages.find((p) => p.id === option.id);
            if (view) sheets.open(<EditPackageSheet finalistId={id} finalistName={name} option={view} />);
          }}
          onRemove={(option) => void removeOne(option)}
        />
      ) : (
        <p className={styles.note}>{NO_PACKAGES}</p>
      )}
      {lean.failed && <Failure name={name} retry={lean.retry} />}
      <p className={styles.add}>
        <Btn variant="quiet" small onClick={() => sheets.open(<AddPackageSheet finalistId={id} finalistName={name} />)}>
          Add a package
        </Btn>
      </p>

      <SectionHeading>Contact and popularity</SectionHeading>
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
        <FieldRow label="Reviews" field={reviewers}>
          <NumberInput
            {...reviewers.bind}
            inputMode="numeric"
            placeholder="How many reviews"
            show={n0}
            read={readCount}
            say={reviewsMessage}
          />
        </FieldRow>
        <FieldRow label="Instagram followers" field={followers}>
          <NumberInput
            {...followers.bind}
            inputMode="numeric"
            placeholder="How many followers"
            show={n0}
            read={readCount}
            say={followersMessage}
          />
        </FieldRow>
        <FieldRow label="Next step" field={step}>
          <FieldInput {...step.bind} placeholder="What has to happen next" />
        </FieldRow>
      </Fields>

      <Notes {...notes.bind} field={notes} />

      <SectionHeading small={filesCount(finalist.files.length)}>Files</SectionHeading>
      {finalist.sourceVendor && <p className={styles.filesNote}>{filesFromVendor(finalist.sourceVendor.name)}</p>}
      <FileTiles files={finalist.files} queue={queue} />

      {finalist.booked ? null : (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{CHOSEN_TITLE}</h2>
          <p className={styles.cardNote}>{chosenNote(canMove)}</p>
          <p className={styles.cardActs}>
            {canMove && (
              <Btn variant="quiet" onClick={() => sheets.open(<MoveSheet finalistId={id} name={name} />)}>
                Move into Vendors
              </Btn>
            )}
            <Btn
              onClick={() =>
                sheets.open(
                  <BookSheet
                    finalistId={id}
                    name={name}
                    packages={finalist.packages}
                    leaningId={finalist.leaningId}
                    onBooked={(bookingId) => router.push(veilHref(`/budget/bookings/${bookingId}`))}
                  />,
                )
              }
            >
              Book it
            </Btn>
          </p>
        </section>
      )}

      <div className={styles.danger}>
        <TextLink tone="rose" onClick={() => void removeFromShortlist()}>
          Remove from the shortlist
        </TextLink>
      </div>
    </>
  );
}
