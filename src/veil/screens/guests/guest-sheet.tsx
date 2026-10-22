"use client";

import { useEffect, useRef, useState } from "react";
import { addGuest, newGuestId, removeGuest, setGuestField, setGuestRsvp, useGuests, type NewGuest } from "@/lib/data/guests";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { type GuestRecord } from "@/lib/model/guests";
import { GUEST_EVENTS, type GuestEvent, type Rsvp } from "@/lib/model/labels";
import { TextLink } from "@/veil/parts/actions/text-link";
import { ChipGroup } from "@/veil/parts/chips/chip";
import { Check, FieldInput, FieldRow, FieldText, Fields, Stepper } from "@/veil/parts/fields/fields";
import { SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import { RsvpSwitch } from "@/veil/parts/guests/guest-row";
import { Banner } from "@/veil/shell/banner";
import { useConfirm } from "@/veil/shell/confirm";
import { useFlasher } from "@/veil/shell/flash";
import { CreateSheetActions, EditSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import {
  ADD_AND_ANOTHER,
  ADD_FAILED,
  ADD_GUEST,
  ADD_A_GUEST,
  CONNECTION_HINT,
  CONNECTION_LABEL,
  CONNECTION_PLACEHOLDER,
  COUNTRY_LABEL,
  FOOD_LABEL,
  FOOD_PLACEHOLDER,
  INVITATION_LABEL,
  INVITATION_SENT,
  INVITED_LABEL,
  NAME_LABEL,
  NAME_MISSING,
  PLUS_ONES_LABEL,
  REMOVE_ACTION,
  RSVP_LABEL,
  addSheetSub,
  addedToast,
  editSheetSub,
  removeBody,
  removeTitle,
  removedToast,
} from "./guests-text";

/** What a new guest starts as (the prototype's defaults). */
const FRESH = {
  name: "",
  connection: "",
  country: "Indonesia",
  eventType: "Both" as GuestEvent,
  inviteSent: false,
  rsvpStatus: "pending" as Rsvp,
  plusOnes: 0,
  allergies: "",
};

type Busy = "add" | "another" | null;

/**
 * "Add a guest" (guide §5.23, G1, G2, G6): "Will be guest number 21", every field, then Add and start
 * another or Add guest. A name is enough. The record's id is made on the first press and kept until it
 * lands, so Try again after a lost connection writes the same guest and never a second; the number is
 * issued in the same write. Add and start another empties the sheet for the next guest and keeps it open.
 */
export function AddGuestSheet({ onAdded }: { onAdded: (id: string) => void }) {
  const sheet = useSheet();
  const toast = useToast();
  const flash = useFlasher();
  const book = useGuests().data;

  const [form, setForm] = useState(FRESH);
  const [problem, setProblem] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  // The number just issued: the counter's own update can arrive a moment after the write.
  const [issued, setIssued] = useState(0);
  const id = useRef<string | null>(null);
  // What the first try for this guest sent: Try again writes only what changed since.
  const firstTry = useRef<NewGuest | null>(null);
  // Which press is the newest: an older one still landing writes nothing over it (Phase 6 review S10).
  const tries = useRef(0);
  const nameInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof typeof FRESH>(key: K, value: (typeof FRESH)[K]) => setForm((now) => ({ ...now, [key]: value }));
  const number = Math.max(book?.nextNumber ?? 1, issued + 1);

  async function add(again: boolean) {
    if (busy) return;
    if (!form.name.trim()) {
      setProblem(NAME_MISSING);
      nameInput.current?.focus();
      return;
    }
    setFailed(false);
    setBusy(again ? "another" : "add");
    id.current ??= newGuestId();
    const guestId = id.current;
    const guest: NewGuest = {
      id: guestId,
      name: form.name,
      connection: form.connection.trim(),
      country: form.country.trim(),
      eventType: form.eventType,
      inviteSent: form.inviteSent,
      rsvpStatus: form.rsvpStatus,
      plusOnes: form.plusOnes,
      allergies: form.allergies.trim(),
    };
    const first = firstTry.current;
    firstTry.current ??= guest;
    const tap = ++tries.current;
    const superseded = () => tries.current !== tap;
    let added: { id: string; number: number };
    try {
      added = await addGuest(guest, first ? { first, superseded } : { superseded });
    } catch {
      setBusy(null);
      setFailed(true);
      return;
    }
    toast.confirmation(addedToast(form.name, added.number));
    flash({ kind: "guest", id: guestId });
    onAdded(guestId);
    setIssued(added.number);
    setBusy(null);
    if (!again) {
      sheet.close();
      return;
    }
    id.current = null;
    firstTry.current = null;
    setForm(FRESH);
    setProblem(null);
    sheet.focusFirstField();
  }

  return (
    <Sheet title={ADD_A_GUEST} sub={addSheetSub(number)}>
      <Fields>
        <FieldRow label={NAME_LABEL} problem={problem}>
          <FieldInput
            ref={nameInput}
            autoFocus
           
            value={form.name}
            onChange={(next) => {
              set("name", next);
              setProblem(null);
            }}
          />
        </FieldRow>
        <FieldRow label={CONNECTION_LABEL} hint={CONNECTION_HINT}>
          <FieldInput placeholder={CONNECTION_PLACEHOLDER} value={form.connection} onChange={(next) => set("connection", next)} />
        </FieldRow>
        <FieldRow label={COUNTRY_LABEL}>
          <FieldInput value={form.country} onChange={(next) => set("country", next)} />
        </FieldRow>
        <FieldRow label={INVITED_LABEL} group>
          <ChipGroup label={INVITED_LABEL} options={GUEST_EVENTS} value={form.eventType} onChange={(next) => set("eventType", next)} />
        </FieldRow>
        <FieldRow label={INVITATION_LABEL} group>
          <Check value={form.inviteSent} onChange={(next) => set("inviteSent", next)}>
            {INVITATION_SENT}
          </Check>
        </FieldRow>
        <FieldRow label={RSVP_LABEL} group>
          <RsvpSwitch label={RSVP_LABEL} value={form.rsvpStatus} onChange={(next) => set("rsvpStatus", next)} />
        </FieldRow>
        <FieldRow label={PLUS_ONES_LABEL} group>
          <Stepper value={form.plusOnes} onChange={(next) => set("plusOnes", next)} />
        </FieldRow>
        <FieldRow label={FOOD_LABEL}>
          <FieldText placeholder={FOOD_PLACEHOLDER} value={form.allergies} onChange={(next) => set("allergies", next)} />
        </FieldRow>
      </Fields>
      {failed && (
        <Banner tone="rose" inline role="alert">
          {ADD_FAILED}
        </Banner>
      )}
      <CreateSheetActions
        action={failed ? "Try again" : ADD_GUEST}
        busy={busy === "add"}
        busyLabel="Adding"
        onAction={() => void add(false)}
        another={{ label: ADD_AND_ANOTHER, onAction: () => void add(true), busy: busy === "another", busyLabel: "Adding" }}
      />
    </Sheet>
  );
}

/**
 * A guest's sheet (guide §5.23, G1, G2, G7): every field saves as you go and Done closes. It reads the
 * guest live, so the partner's reply shows in place and a guest the partner removed closes the sheet.
 * A cleared name comes back as it was. Remove guest asks first, names the plus-ones and the headcount
 * drop, and offers Undo.
 */
export function EditGuestSheet({ guestId }: { guestId: string }) {
  const sheet = useSheet();
  const read = useGuests();
  const live = read.data?.guests.find((g) => g.id === guestId) ?? null;
  const gone = read.status === "ready" && !live;

  // The last guest read stays on show while the sheet closes after the removal.
  const [kept, setKept] = useState<GuestRecord | null>(live);
  if (live && live !== kept) setKept(live);
  const guest = live ?? kept;

  useEffect(() => {
    if (gone) sheet.close();
  }, [gone, sheet]);

  return <SaveScopeProvider sheet>{guest ? <EditBody guest={guest} /> : <Sheet title="Guest" />}</SaveScopeProvider>;
}

function EditBody({ guest }: { guest: GuestRecord }) {
  const sheet = useSheet();
  const toast = useToast();
  const confirm = useConfirm();
  const flash = useFlasher();
  const { id, name } = guest;

  const text = (field: "connection" | "country" | "allergies") => ({
    value: guest[field],
    normalize: (v: string) => v.trim(),
    save: (next: string) => setGuestField(id, field, next),
  });
  const nameField = useAutosaveField({
    value: guest.name,
    required: true,
    normalize: (v: string) => v.trim(),
    save: (next: string) => setGuestField(id, "name", next),
  });
  const connection = useAutosaveField(text("connection"));
  const country = useAutosaveField(text("country"));
  const invited = useAutosaveField<GuestEvent>({ value: guest.eventType, save: (next) => setGuestField(id, "eventType", next) });
  const sent = useAutosaveField<boolean>({ value: guest.inviteSent, save: (next) => setGuestField(id, "inviteSent", next) });
  const rsvp = useAutosaveField<Rsvp>({ value: guest.rsvpStatus, save: (next) => setGuestRsvp({ id, name }, next) });
  const plus = useAutosaveField<number>({ value: guest.plusOnes, save: (next) => setGuestField(id, "plusOnes", next) });
  const food = useAutosaveField(text("allergies"));

  async function remove() {
    const removed: { undo?: () => Promise<void> } = {};
    const done = await confirm({
      title: removeTitle(name),
      body: removeBody(guest),
      action: REMOVE_ACTION,
      danger: true,
      run: async () => {
        removed.undo = (await removeGuest(id)).undo;
      },
    });
    if (!done || !removed.undo) return;
    const undo = removed.undo;
    toast.undoable(removedToast(name), async () => {
      await undo();
      flash({ kind: "guest", id });
    });
    sheet.close();
  }

  return (
    <Sheet title={name} sub={editSheetSub(guest.number)}>
      <Fields>
        <FieldRow label={NAME_LABEL} field={nameField}>
          <FieldInput {...nameField.bind} />
        </FieldRow>
        <FieldRow label={CONNECTION_LABEL} hint={CONNECTION_HINT} field={connection}>
          <FieldInput {...connection.bind} placeholder={CONNECTION_PLACEHOLDER} />
        </FieldRow>
        <FieldRow label={COUNTRY_LABEL} field={country}>
          <FieldInput {...country.bind} />
        </FieldRow>
        <FieldRow label={INVITED_LABEL} group field={invited}>
          <ChipGroup label={INVITED_LABEL} options={GUEST_EVENTS} value={invited.draft} disabled={invited.disabled} onChange={invited.commit} />
        </FieldRow>
        <FieldRow label={INVITATION_LABEL} group field={sent}>
          <Check {...sent.bind}>{INVITATION_SENT}</Check>
        </FieldRow>
        <FieldRow label={RSVP_LABEL} group field={rsvp}>
          <RsvpSwitch label={RSVP_LABEL} value={rsvp.draft} disabled={rsvp.disabled} failed={rsvp.failed} onChange={rsvp.commit} />
        </FieldRow>
        <FieldRow label={PLUS_ONES_LABEL} group field={plus}>
          <Stepper {...plus.bind} />
        </FieldRow>
        <FieldRow label={FOOD_LABEL} field={food}>
          <FieldText {...food.bind} placeholder={FOOD_PLACEHOLDER} />
        </FieldRow>
      </Fields>
      <EditSheetActions
        link={
          <TextLink tone="rose" onClick={() => void remove()}>
            {REMOVE_ACTION}
          </TextLink>
        }
      />
    </Sheet>
  );
}
