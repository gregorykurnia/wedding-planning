"use client";

import { useRef, useState } from "react";
import { addVendor, useCategories } from "@/lib/data/vendors";
import { newId } from "@/lib/data/write";
import { buildCategories } from "@/lib/model/categories";
import { FieldInput, FieldRow, Fields, FieldSelect, FieldText } from "@/veil/parts/fields/fields";
import { Banner } from "@/veil/shell/banner";
import { useFlasher } from "@/veil/shell/flash";
import { CreateSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import { ADD_FAILED, NAME_MISSING, addedToast } from "./vendors-text";
import { OfflineOr } from "@/veil/parts/fields/offline-or";

type Mode = "idle" | "adding" | "another";

/**
 * "Add a vendor" (guide §5.11, F6): a name is enough. The form's record id is
 * made on the first press and kept until it lands, so Try again after a lost
 * connection writes the same vendor and never a second one. "Add and start
 * another" clears the form for the next vendor and keeps the category.
 */
export function AddVendorSheet({ category }: { category: string }) {
  const sheet = useSheet();
  const toast = useToast();
  const flash = useFlasher();
  const categories = useCategories();
  const list = categories.data?.list ?? buildCategories([]);

  const [name, setName] = useState("");
  const [chosen, setChosen] = useState(category && list.includes(category) ? category : "Other");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const id = useRef<string | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  async function add(another: boolean) {
    if (mode !== "idle") return;
    if (!name.trim()) {
      setProblem(NAME_MISSING);
      nameInput.current?.focus();
      return;
    }
    setFailed(false);
    setMode(another ? "another" : "adding");
    id.current ??= newId("vendors");
    const vendorId = id.current;
    try {
      const { undo } = await addVendor({ id: vendorId, name, category: chosen, contactName, contactPhone, notes });
      toast.undoable(addedToast(name.trim()), undo);
      flash({ kind: "vendor", id: vendorId });
    } catch {
      setMode("idle");
      setFailed(true);
      return;
    }
    id.current = null;
    setMode("idle");
    if (!another) {
      sheet.close();
      return;
    }
    setName("");
    setContactName("");
    setContactPhone("");
    setNotes("");
    nameInput.current?.focus();
  }

  return (
    <Sheet title="Add a vendor" sub="Just the name is enough for now.">
      <Fields>
        <FieldRow label="Name" problem={problem}>
          <FieldInput
            ref={nameInput}
            autoFocus
            placeholder="For example, Bunga Melati Florist"
            value={name}
            onChange={(next) => {
              setName(next);
              setProblem(null);
            }}
          />
        </FieldRow>
        <FieldRow label="Category">
          <FieldSelect
            value={chosen}
            onChange={setChosen}
            options={list.map((c) => ({ value: c, label: c }))}
          />
        </FieldRow>
        <FieldRow label="Contact person">
          <FieldInput value={contactName} onChange={setContactName} />
        </FieldRow>
        <FieldRow label="Phone">
          <FieldInput type="tel" inputMode="tel" placeholder="0812 3456 7890" value={contactPhone} onChange={setContactPhone} />
        </FieldRow>
        <FieldRow label="Notes">
          <FieldText placeholder="Where you found them, what they said" value={notes} onChange={setNotes} />
        </FieldRow>
      </Fields>
      {failed && (
        <Banner tone="rose" inline>
          <OfflineOr>{ADD_FAILED}</OfflineOr>
        </Banner>
      )}
      <CreateSheetActions
        action={failed ? "Try again" : "Add vendor"}
        busy={mode === "adding"}
        busyLabel="Adding"
        onAction={() => void add(false)}
        another={{
          label: "Add and start another",
          busy: mode === "another",
          busyLabel: "Adding",
          onAction: () => void add(true),
        }}
      />
    </Sheet>
  );
}
