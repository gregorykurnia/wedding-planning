"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bookingIdOf } from "@/lib/data/bookings";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { useToday } from "@/lib/data/use-today";
import { useUploadQueue } from "@/lib/data/uploads";
import { addVenue, removeVenueFromList, setVenueField, setVenueStage, useVenue } from "@/lib/data/venues";
import { newId } from "@/lib/data/write";
import { n0 } from "@/lib/model/format";
import {
  ADD_FAILED,
  NAME_MISSING,
  REMOVE_ACTION,
  addedToast,
  bookingToast,
  guestsMessage,
  readGuests,
  removeVenueBody,
  removeVenueTitle,
  removedToast,
  type VenueDetail,
} from "@/lib/model/venues";
import { TextLink } from "@/veil/parts/actions/text-link";
import { FieldInput, FieldRow, Fields, FieldText } from "@/veil/parts/fields/fields";
import { MoneyInput } from "@/veil/parts/fields/money";
import { NumberInput } from "@/veil/parts/fields/number";
import { SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import { FileTiles } from "@/veil/parts/files/file-tiles";
import { StageChips } from "@/veil/parts/stage/stage-chips";
import { veilHref } from "@/veil/href";
import { Banner } from "@/veil/shell/banner";
import { useConfirm } from "@/veil/shell/confirm";
import { useFlasher } from "@/veil/shell/flash";
import { CreateSheetActions, EditSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { SheetReadState } from "@/veil/shell/sheet-read-state";
import { useToast } from "@/veil/shell/toasts";
import styles from "./venue-sheet.module.css";
import { OfflineOr } from "@/veil/parts/fields/offline-or";

const bookingHref = (id: string) => veilHref(`/budget/bookings/${bookingIdOf({ kind: "venue", id })}`);

/**
 * "Add a venue" (guide §5.15, F1): stage chips, then name, location, estimated
 * cost, most guests and notes, with Cancel and Add venue. A name is enough. The
 * record's id is made on the first press and kept until it lands, so Try again
 * after a lost connection writes the same venue and never a second. Adding it as
 * Booked makes it a booking (B1), and the toast says so with Open; otherwise the
 * toast offers Undo.
 */
export function AddVenueSheet() {
  const sheet = useSheet();
  const toast = useToast();
  const flash = useFlasher();
  const router = useRouter();
  const today = useToday();

  const [stage, setStage] = useState("Shortlist");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [cost, setCost] = useState<number | null>(null);
  const [guests, setGuests] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
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
    id.current ??= newId("venues");
    const venueId = id.current;
    try {
      const { undo, becameBooking } = await addVenue({ id: venueId, name, location, cost, guests, notes, stage }, today);
      if (becameBooking) toast.next(bookingToast(name.trim()), "Open", () => router.push(bookingHref(venueId)));
      else toast.undoable(addedToast(name.trim()), undo);
      flash({ kind: "venue", id: venueId });
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    sheet.close();
  }

  return (
    <Sheet title="Add a venue">
      <StageChips kind="venue" stage={stage} className={styles.stage} onChange={setStage} />
      <Fields>
        <FieldRow label="Name" problem={problem}>
          <FieldInput
            ref={nameInput}
            autoFocus
            placeholder="For example, Puri Taman Sari"
            value={name}
            onChange={(next) => {
              setName(next);
              setProblem(null);
            }}
          />
        </FieldRow>
        <FieldRow label="Location">
          <FieldInput value={location} onChange={setLocation} />
        </FieldRow>
        <FieldRow label="Estimated cost">
          <MoneyInput value={cost} onCommit={setCost} />
        </FieldRow>
        <FieldRow label="Most guests">
          <GuestsInput value={guests} onCommit={setGuests} />
        </FieldRow>
        <FieldRow label="Notes">
          <FieldText value={notes} onChange={setNotes} />
        </FieldRow>
      </Fields>
      {failed && (
        <Banner tone="rose" inline>
          <OfflineOr>{ADD_FAILED}</OfflineOr>
        </Banner>
      )}
      <CreateSheetActions
        action={failed ? "Try again" : "Add venue"}
        busy={busy}
        busyLabel="Adding"
        onAction={() => void add()}
      />
    </Sheet>
  );
}

function GuestsInput(props: { value: number | null; onCommit: (value: number | null) => void; disabled?: boolean }) {
  return (
    <NumberInput
      {...props}
      inputMode="numeric"
      placeholder="Maximum capacity"
      show={n0}
      read={readGuests}
      say={guestsMessage}
    />
  );
}

/**
 * A venue's sheet (guide §5.15): every field saves as you go and Done closes.
 * It reads the venue live, so the partner's change shows in place and a venue
 * the partner removed closes the sheet. Choosing Booked makes it a booking, once
 * (B1). Remove venue asks first and offers Undo (N10).
 */
export function EditVenueSheet({ venueId }: { venueId: string }) {
  const sheet = useSheet();
  const read = useVenue(venueId);
  const live = read.data?.venue ?? null;
  const gone = read.status === "ready" && !live;

  // The last venue read stays on show while the sheet closes after its removal.
  const [kept, setKept] = useState<VenueDetail | null>(live);
  if (live && live !== kept) setKept(live);
  const venue = live ?? kept;

  useEffect(() => {
    if (gone) sheet.close();
  }, [gone, sheet]);

  return (
    <SaveScopeProvider sheet>
      {venue ? <EditBody venue={venue} /> : <SheetReadState read={read} title="Venue" what="this venue" />}
    </SaveScopeProvider>
  );
}

function EditBody({ venue }: { venue: VenueDetail }) {
  const sheet = useSheet();
  const toast = useToast();
  const confirm = useConfirm();
  const flash = useFlasher();
  const router = useRouter();
  const today = useToday();
  const { id, name } = venue;

  const queue = useUploadQueue({ kind: "record", ref: { kind: "venue", id }, recordName: name });

  const stage = useAutosaveField<string>({
    value: venue.status,
    save: async (next) => {
      const { becameBooking } = await setVenueStage(id, next, today);
      if (becameBooking) toast.next(bookingToast(name), "Open", () => router.push(bookingHref(id)));
    },
  });
  const nameField = useAutosaveField({
    value: venue.name,
    required: true,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setVenueField(id, "name", next),
  });
  const location = useAutosaveField({
    value: venue.location,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setVenueField(id, "location", next),
  });
  const cost = useAutosaveField<number | null>({
    value: venue.budgetEstimate > 0 ? venue.budgetEstimate : null,
    save: (next) => setVenueField(id, "cost", next),
  });
  const guests = useAutosaveField<number | null>({
    value: venue.guestMax > 0 ? venue.guestMax : null,
    save: (next) => setVenueField(id, "guests", next),
  });
  const notes = useAutosaveField({ value: venue.notes, save: (next: string) => setVenueField(id, "notes", next) });

  async function remove() {
    const removed: { undo?: () => Promise<void> } = {};
    const done = await confirm({
      title: removeVenueTitle(name),
      body: removeVenueBody({
        name,
        hasNotes: Boolean(venue.notes.trim()),
        fileCount: venue.files.length,
        booked: venue.booked,
      }),
      action: REMOVE_ACTION,
      danger: true,
      run: async () => {
        removed.undo = (await removeVenueFromList(id)).undo;
      },
    });
    if (!done || !removed.undo) return;
    const undo = removed.undo;
    toast.undoable(removedToast(name), async () => {
      await undo();
      flash({ kind: "venue", id });
    });
    sheet.close();
  }

  return (
    <Sheet title={name}>
      <StageChips
        kind="venue"
        stage={stage.draft}
        disabled={stage.disabled}
        className={styles.stage}
        onChange={stage.commit}
      />
      <Fields>
        <FieldRow label="Name" field={nameField}>
          <FieldInput {...nameField.bind} placeholder="For example, Puri Taman Sari" />
        </FieldRow>
        <FieldRow label="Location" field={location}>
          <FieldInput {...location.bind} />
        </FieldRow>
        <FieldRow label="Estimated cost" field={cost}>
          <MoneyInput {...cost.bind} />
        </FieldRow>
        <FieldRow label="Most guests" field={guests}>
          <GuestsInput {...guests.bind} />
        </FieldRow>
        <FieldRow label="Notes" field={notes}>
          <FieldText {...notes.bind} />
        </FieldRow>
      </Fields>

      <h3 className={styles.section}>Files</h3>
      <FileTiles
        files={venue.files.map((f) => ({ id: f.id, name: f.name, url: f.url, size: f.size, mime: f.mime }))}
        queue={queue}
      />

      <EditSheetActions
        link={
          <TextLink tone="rose" onClick={() => void remove()}>
            Remove venue
          </TextLink>
        }
      />
    </Sheet>
  );
}
