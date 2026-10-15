"use client";

import { useState } from "react";
import { useSettings } from "@/lib/data/settings";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { set, WriteError } from "@/lib/data/write";
import { rp } from "@/lib/model/format";
import { InlineRename } from "@/veil/parts/fields/inline-rename";
import {
  Check,
  DateInput,
  FieldInput,
  FieldRow,
  Fields,
  FieldSelect,
  FieldText,
  Hint,
  StaticValue,
  Stepper,
} from "@/veil/parts/fields/fields";
import { BigInput, MoneyInput } from "@/veil/parts/fields/money";
import { Notes } from "@/veil/parts/fields/notes";
import { SaveLine, SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import styles from "./gallery.module.css";

// Task 3.4: every field type, the save line and the failure path. The first
// three fields save to settings/wedding when the page runs against the
// Firebase emulators (NEXT_PUBLIC_USE_EMULATORS=1); everywhere else they and
// every other field save to a stand-in held in this page, so a gallery visit
// never writes to the real wedding data.

const USE_EMULATOR = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Stand = {
  yourName: string;
  partnerName: string;
  weddingDate: string;
  price: number | null;
  kind: string;
  sent: boolean;
  plus: number;
  memo: string;
  notes: string;
};

const INITIAL: Stand = {
  yourName: "Greg",
  partnerName: "Bella",
  weddingDate: "2027-06-12",
  price: 150_000_000,
  kind: "wedding",
  sent: false,
  plus: 2,
  memo: "",
  notes: "Ask about the tasting. Menu: https://example.com/menu",
};

const KINDS = [
  { value: "wedding", label: "Wedding" },
  { value: "engagement", label: "Engagement" },
  { value: "tea-pai", label: "Tea pai" },
];

export function FieldsDemo() {
  const [demo, setDemo] = useState(false);
  const [fail, setFail] = useState(false);
  const [slow, setSlow] = useState(true);

  return (
    <div className={styles.demo}>
      <div className={styles.controls} role="group" aria-label="Demo switches">
        <label>
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Demonstration mode
        </label>
        <label>
          <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> Make saves fail
        </label>
        <label>
          <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> Slow saves
        </label>
      </div>
      <p className={styles.note}>
        Saving to: {USE_EMULATOR ? "the emulator (names and date)" : "a stand-in held in this page"}.
      </p>

      <h3 className={styles.subheading}>Detail screen form</h3>
      <div role="group" aria-label="Detail screen form">
        <SaveScopeProvider demo={demo}>
          <SaveLine />
          <Form fail={fail} slow={slow} />
        </SaveScopeProvider>
      </div>

      <h3 className={styles.subheading}>Save line in a sheet</h3>
      <div role="group" aria-label="Sheet form">
        <SaveScopeProvider demo={demo} sheet>
          <SheetForm fail={fail} slow={slow} />
        </SaveScopeProvider>
      </div>

      <h3 className={styles.subheading}>Inline rename</h3>
      <RenameDemo fail={fail} slow={slow} />

      <h3 className={styles.subheading}>Big input</h3>
      <BigDemo />
    </div>
  );
}

/** A save that takes a moment, can be made to fail, and lands in `write`. */
function demoSaver(fail: boolean, slow: boolean) {
  return async (write: () => Promise<unknown>) => {
    if (slow) await sleep(700);
    if (fail) throw new WriteError("failed");
    await write();
  };
}

function Form({ fail, slow }: { fail: boolean; slow: boolean }) {
  const settings = useSettings();
  const live = USE_EMULATOR && settings.status !== "demo" && settings.data !== null;
  const [stand, setStand] = useState(INITIAL);
  const saved = demoSaver(fail, slow);

  const keep = <K extends keyof Stand>(key: K) => (next: Stand[K]) =>
    saved(async () => setStand((current) => ({ ...current, [key]: next })));

  const names = (key: "yourName" | "partnerName") =>
    live
      ? {
          value: settings.data?.[key] ?? "",
          save: (next: string) => saved(() => set("settings", "wedding", { [key]: next }, { merge: true })),
        }
      : { value: stand[key], save: keep(key) };

  const first = useAutosaveField({ ...names("yourName"), required: true, normalize: (v: string) => v.trim() });
  const second = useAutosaveField({ ...names("partnerName"), required: true, normalize: (v: string) => v.trim() });
  const date = useAutosaveField({
    value: live ? (settings.data?.weddingDate ?? "") : stand.weddingDate,
    save: (next: string) =>
      live ? saved(() => set("settings", "wedding", { weddingDate: next || null }, { merge: true })) : keep("weddingDate")(next),
  });
  const price = useAutosaveField<number | null>({ value: stand.price, save: keep("price") });
  const kind = useAutosaveField({ value: stand.kind, save: keep("kind") });
  const sent = useAutosaveField({ value: stand.sent, save: keep("sent") });
  const plus = useAutosaveField({ value: stand.plus, save: keep("plus") });
  const memo = useAutosaveField({ value: stand.memo, save: keep("memo") });
  const notes = useAutosaveField({ value: stand.notes, save: keep("notes") });

  return (
    <>
      <Fields>
        <FieldRow label="First name" field={first}>
          <FieldInput {...first.bind} />
        </FieldRow>
        <FieldRow
          label="Second name"
          field={second}
          hint="Used wherever the planner addresses you both."
        >
          <FieldInput {...second.bind} />
        </FieldRow>
        <FieldRow label="Wedding date" field={date} hint="Every countdown and date works from this.">
          <DateInput {...date.bind} />
        </FieldRow>
        <FieldRow label="Agreed price" field={price} hint="What you noted while comparing. It never changes the agreed price.">
          <MoneyInput {...price.bind} />
        </FieldRow>
        <FieldRow label="Kind" field={kind}>
          <FieldSelect {...kind.bind} options={KINDS} />
        </FieldRow>
        <FieldRow label="Invitation" group field={sent}>
          <Check {...sent.bind}>Sent</Check>
        </FieldRow>
        <FieldRow label="Plus-ones" group field={plus}>
          <Stepper {...plus.bind} />
        </FieldRow>
        <FieldRow label="Total" group>
          <StaticValue>
            {rp(150_000_000)} <small>from 3 parts</small>
          </StaticValue>
        </FieldRow>
        <FieldRow label="Booking name" problem="Give the booking a name so you can find it later.">
          <FieldInput value="" placeholder="What has to happen next" />
        </FieldRow>
        <FieldRow label="Memo" field={memo}>
          <FieldText {...memo.bind} placeholder="Anything to remember" />
        </FieldRow>
      </Fields>
      <Notes {...notes.bind} field={notes} />
      <Hint>Saved values: {stand.price === null ? "no price" : rp(stand.price)}, {stand.kind}, {stand.sent ? "sent" : "not sent"}, {stand.plus} plus-ones.</Hint>
    </>
  );
}

function SheetForm({ fail, slow }: { fail: boolean; slow: boolean }) {
  const [name, setName] = useState("Dapur Lestari Catering");
  const saved = demoSaver(fail, slow);
  const field = useAutosaveField({
    value: name,
    save: (next: string) => saved(async () => setName(next)),
    required: true,
    normalize: (v: string) => v.trim(),
  });
  return (
    <div className={styles.sheetFrame}>
      <Fields>
        <FieldRow label="Name" field={field}>
          <FieldInput {...field.bind} />
        </FieldRow>
      </Fields>
      <SaveLine />
    </div>
  );
}

function RenameDemo({ fail, slow }: { fail: boolean; slow: boolean }) {
  const [name, setName] = useState("Greg");
  const [editing, setEditing] = useState(false);
  const saved = demoSaver(fail, slow);
  return (
    <div className={styles.renameDemo} role="group" aria-label="Inline rename demo">
      {editing ? (
        <InlineRename
          name={name}
          label="Funder’s name"
          onSave={(next) => saved(async () => setName(next))}
          onClose={() => setEditing(false)}
        />
      ) : (
        <p>
          <span data-testid="funder-name">{name}</span>{" "}
          <button type="button" onClick={() => setEditing(true)}>
            Rename
          </button>
        </p>
      )}
    </div>
  );
}

function BigDemo() {
  const [amount, setAmount] = useState<number | null>(48_000_000);
  const left = 75_000_000;
  const after = left - (amount ?? 0);
  return (
    <div className={styles.sheetFrame} role="group" aria-label="Big input demo">
      <BigInput label="Amount paid" id="big-demo" value={amount} onChange={setAmount} aria-describedby="big-demo-after" />
      <p className={styles.note} id="big-demo-after">
        Read as {amount === null ? "nothing" : rp(amount)}; {rp(after)} would be left.
      </p>
    </div>
  );
}
