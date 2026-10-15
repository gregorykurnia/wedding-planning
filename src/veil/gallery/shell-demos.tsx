"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { veilHref } from "@/veil/href";
import { useConfirm } from "@/veil/shell/confirm";
import { Sheet, SheetActions, useSheet, useSheets } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";

/**
 * Dev-only demos of the sheet host, confirm and toasts (Task 2.6). Task 3.0's
 * gallery lists this page; the e2e test drives it. The "records" are fake.
 */

interface FakeRecord {
  id: string;
  name: string;
}

const START: FakeRecord[] = [
  { id: "villa", name: "Villa Samaya Ubud" },
  { id: "catering", name: "Dapur Lestari Catering" },
  { id: "florist", name: "Bunga Melati Florist" },
];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ShellDemos() {
  const toast = useToast();
  const sheets = useSheets();
  const confirm = useConfirm();
  const [records, setRecords] = useState(START);
  const failNext = useRef(false);
  const slowNext = useRef(false);

  async function write(change: () => void) {
    const slow = slowNext.current;
    slowNext.current = false;
    await pause(slow ? 2000 : 300);
    if (failNext.current) {
      failNext.current = false;
      throw new Error("The write failed");
    }
    change();
  }

  async function remove(record: FakeRecord) {
    const index = records.findIndex((r) => r.id === record.id);
    const removed = await confirm({
      title: `Remove ${record.name}?`,
      body: "It leaves the budget. You can undo for a few seconds.",
      action: "Remove booking",
      run: () => write(() => setRecords((all) => all.filter((r) => r.id !== record.id))),
    });
    if (!removed) return;
    toast.undoable(`Removed ${record.name}`, () =>
      write(() =>
        setRecords((all) => {
          const next = [...all];
          next.splice(Math.min(index, next.length), 0, record);
          return next;
        }),
      ),
    );
  }

  return (
    <div>
      <h1>Sheets, confirm and toasts</h1>

      <h2>Fake records</h2>
      <ul aria-label="Fake records">
        {records.map((record) => (
          <li key={record.id}>
            {record.name}{" "}
            <button type="button" onClick={() => void remove(record)}>
              Remove {record.name}
            </button>
          </li>
        ))}
      </ul>
      <label>
        <input type="checkbox" onChange={(e) => (failNext.current = e.target.checked)} /> Make the
        next write fail
      </label>{" "}
      <label>
        <input type="checkbox" onChange={(e) => (slowNext.current = e.target.checked)} /> Make the
        next write slow
      </label>{" "}
      {/* Leaving while a confirm is busy must still give the undo toast. */}
      <Link id="leave-demo" href={veilHref("/gallery/partner")}>
        Go to the partner demo
      </Link>

      <h2>Toasts</h2>
      <p>
        <button type="button" onClick={() => toast.confirmation("Saved")}>
          Show a confirmation
        </button>{" "}
        <button type="button" onClick={() => toast.next("Kebun Bunga Atelier is now a booking", "Open", () => toast.confirmation("Opened"))}>
          Show a next step
        </button>{" "}
        <button type="button" onClick={() => toast.partner("Bella", "Bella recorded Rp 55.500.000 for Dapur Lestari Catering")}>
          Show a partner change
        </button>{" "}
        <button type="button" onClick={() => toast.demo()}>
          Show the demonstration toast
        </button>
      </p>

      <h2>Sheets</h2>
      <p>
        <button type="button" onClick={() => sheets.open(<DemoSheet />)}>
          Open a sheet
        </button>
      </p>
    </div>
  );
}

function DemoSheet() {
  const sheet = useSheet();
  const confirm = useConfirm();
  const [name, setName] = useState("");

  async function discard() {
    const gone = await confirm({
      title: "Delete this sheet?",
      body: "Whatever you typed goes with it.",
      action: "Delete",
      run: () => pause(300),
    });
    if (gone) sheet.close();
  }

  return (
    <Sheet title="A demo sheet" sub="Just the name is enough for now.">
      <p style={{ textAlign: "center" }}>
        <input
          aria-label="Name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </p>
      <SheetActions>
        <button type="button" onClick={sheet.close}>
          Cancel
        </button>
        <button type="button" onClick={() => void discard()}>
          Delete
        </button>
      </SheetActions>
    </Sheet>
  );
}
