"use client";

import { useRef, useState } from "react";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { FieldInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import { Banner, Problem } from "@/veil/shell/banner";
import { InlineConfirm, useBlocked, useConfirm } from "@/veil/shell/confirm";
import {
  CreateSheetActions,
  EditSheetActions,
  Sheet,
  SheetActions,
  useSheet,
  useSheets,
} from "@/veil/shell/sheet";
import galleryStyles from "./gallery.module.css";
import styles from "./sheets-demos.module.css";

// Task 3.8: the create and edit sheets, the inline and blocked confirms, and the
// banners and problem boxes (guide §4.14, §4.15, §4.17). Every write is a
// stand-in held in this page, so a gallery visit never writes real data. The
// two switches apply to the next write, whichever sheet made it.

type Flags = { fail: boolean; slow: boolean };
type FlagsRef = { current: Flags };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The stand-in write: it waits, and fails when the switch says so. */
async function stand(flags: FlagsRef) {
  await pause(flags.current.slow ? 1500 : 400);
  if (flags.current.fail) throw new Error("The write failed");
}

const CATEGORIES = [
  { name: "Florist", vendors: 4 },
  { name: "Catering", vendors: 2 },
  { name: "Venues", vendors: 3 },
];

export function SheetsDemos() {
  const sheets = useSheets();
  const confirm = useConfirm();
  const blocked = useBlocked();
  const flags = useRef<Flags>({ fail: false, slow: false });

  return (
    <div className={galleryStyles.demo}>
      <div className={galleryStyles.controls} role="group" aria-label="Demo switches">
        <label>
          <input type="checkbox" onChange={(e) => (flags.current.fail = e.target.checked)} /> Make
          saves fail
        </label>
        <label>
          <input type="checkbox" onChange={(e) => (flags.current.slow = e.target.checked)} /> Slow
          saves
        </label>
      </div>

      <h3 className={galleryStyles.subheading}>Create sheet</h3>
      <div className={styles.actions}>
        <Btn variant="quiet" onClick={() => sheets.open(<CreateDemo flags={flags} demo={false} />)}>
          Add a booking
        </Btn>
        <Btn variant="quiet" onClick={() => sheets.open(<CreateDemo flags={flags} demo />)}>
          Add a booking in demonstration mode
        </Btn>
      </div>

      <h3 className={galleryStyles.subheading}>Edit sheet</h3>
      <div className={styles.actions}>
        <Btn variant="quiet" onClick={() => sheets.open(<EditDemo flags={flags} />)}>
          Edit a vendor
        </Btn>
      </div>

      <h3 className={galleryStyles.subheading}>Confirm variants</h3>
      <div className={styles.actions}>
        <Btn
          variant="quiet"
          onClick={() =>
            void confirm({
              title: "Remove Villa Samaya Ubud?",
              body: "It leaves the budget, with its 3 parts, Rp 50.000.000 of recorded payments and 2 files. You can undo for a few seconds.",
              action: "Remove booking",
              run: () => stand(flags),
            })
          }
        >
          Remove a booking
        </Btn>
        <Btn variant="quiet" onClick={() => sheets.open(<CategoriesDemo flags={flags} />)}>
          Edit categories
        </Btn>
        <Btn
          variant="quiet"
          onClick={() =>
            void blocked({
              title: "Empty Catering first",
              body: "It still holds 4 files and 1 folder. Move or delete them, then delete the folder.",
            })
          }
        >
          Delete the Catering folder
        </Btn>
      </div>

      <h3 className={galleryStyles.subheading}>Banners</h3>
      <div className={styles.stack}>
        <Banner>
          Demonstration mode. The planner isn’t connected to its database yet, so there’s nothing
          to show and changes aren’t saved.
        </Banner>
        <Banner>
          <span aria-hidden="true">● </span>Bella is also in this document. Their changes appear as
          they type.
        </Banner>
        <Banner>
          The tracker starts with 14 common items. Rename, fill in or remove any of them.
        </Banner>
        <Banner tone="rose" inline>
          The booking wasn’t added: the planner lost its connection. Everything you entered is still
          here.
        </Banner>
      </div>

      <h3 className={galleryStyles.subheading}>Problem boxes</h3>
      <div className={styles.stack}>
        <Problem role="alert">
          That email and password don’t match. Check them and try again, or continue with Google.
        </Problem>
        <Problem tone="calm">
          You’re offline. Signing in needs a connection; try again once this device is back online.
        </Problem>
      </div>
    </div>
  );
}

function CreateDemo({ flags, demo }: { flags: FlagsRef; demo: boolean }) {
  const sheet = useSheet();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);

  async function add() {
    setFailed(false);
    setAdding(true);
    try {
      await stand(flags);
    } catch {
      setAdding(false);
      setFailed(true);
      return;
    }
    sheet.close();
  }

  return (
    <Sheet title="Add a booking" sub="Just the name is enough for now.">
      <Fields>
        <FieldRow label="Name">
          <FieldInput value={name} onChange={setName} />
        </FieldRow>
      </Fields>
      {failed && (
        <Banner tone="rose" inline>
          The booking wasn’t added: the planner lost its connection. Everything you entered is still
          here.
        </Banner>
      )}
      <CreateSheetActions
        action={failed ? "Try again" : "Add a booking"}
        busy={adding}
        busyLabel="Adding"
        demo={demo}
        onAction={() => void add()}
      />
    </Sheet>
  );
}

function EditDemo({ flags }: { flags: FlagsRef }) {
  // The scope is above the fields, so the save line sees every change.
  return (
    <SaveScopeProvider sheet demo={false}>
      <EditForm flags={flags} />
    </SaveScopeProvider>
  );
}

function EditForm({ flags }: { flags: FlagsRef }) {
  const sheet = useSheet();
  const confirm = useConfirm();
  const [saved, setSaved] = useState("Bunga Melati Florist");
  const name = useAutosaveField({
    value: saved,
    required: true,
    save: async (next: string) => {
      await stand(flags);
      setSaved(next);
    },
  });

  async function remove() {
    const gone = await confirm({
      title: `Remove ${saved}?`,
      body: "It goes with its 2 files. You can undo for a few seconds.",
      action: "Remove vendor",
      run: () => stand(flags),
    });
    if (gone) sheet.close();
  }

  return (
    <Sheet title="Edit the vendor">
      <Fields>
        <FieldRow
          label="Name"
          field={{ failed: name.failed, retry: name.retry, disabled: name.disabled }}
        >
          <FieldInput {...name.bind} />
        </FieldRow>
      </Fields>
      <EditSheetActions
        link={
          <TextLink tone="rose" onClick={() => void remove()}>
            Remove vendor
          </TextLink>
        }
      />
    </Sheet>
  );
}

function CategoriesDemo({ flags }: { flags: FlagsRef }) {
  const sheet = useSheet();
  const [list, setList] = useState(CATEGORIES);
  const [asking, setAsking] = useState<string | null>(null);

  return (
    <Sheet
      title="Categories"
      sub="Categories you add are shared with Bella. “Other” is always there for anything that doesn’t fit."
    >
      <ul aria-label="Categories" className={styles.list}>
        {list.map((category) => (
          <li key={category.name}>
            {asking === category.name ? (
              <InlineConfirm
                question={
                  <>
                    Remove <b>{category.name}</b>?
                  </>
                }
                body={`Its ${category.vendors} vendors move to Other.`}
                action="Remove category"
                run={() => stand(flags)}
                onKeep={() => setAsking(null)}
                onDone={() => {
                  setList((all) => all.filter((c) => c.name !== category.name));
                  setAsking(null);
                }}
              />
            ) : (
              <div className={styles.row}>
                <span>
                  {category.name}, {category.vendors} vendors
                </span>
                <TextLink tone="rose" onClick={() => setAsking(category.name)}>
                  Remove
                </TextLink>
              </div>
            )}
          </li>
        ))}
      </ul>
      <SheetActions>
        <Btn variant="quiet" onClick={sheet.close}>
          Done
        </Btn>
      </SheetActions>
    </Sheet>
  );
}
