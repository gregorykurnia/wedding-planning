"use client";

import { useState } from "react";
import type { AgendaItem } from "@/lib/model/agenda";
import type { Booking, IsoDate, Part } from "@/lib/model/bookings";
import type { ItemRecord } from "@/lib/model/items";
import { dues, type Funder } from "@/lib/model/money";
import type { TaskRecord } from "@/lib/model/tasks";
import { AgendaRow } from "@/veil/parts/agenda/agenda-row";
import { ItemRow } from "@/veil/parts/items/item-row";
import { TaskRow } from "@/veil/parts/tasks/task-row";
import { BookingEntry } from "@/veil/parts/rows/booking-entry";
import { DocumentRow, type DocumentRowData } from "@/veil/parts/rows/document-row";
import { DueRow } from "@/veil/parts/rows/due-row";
import { FileRow, FolderRow, type FileRowData } from "@/veil/parts/rows/file-row";
import { Ledger } from "@/veil/parts/rows/ledger";
import { VendorRow, type VendorRowData } from "@/veil/parts/rows/vendor-row";
import { WhatIfEntry, type WhatIfItem } from "@/veil/parts/rows/what-if-entry";
import { KeenHeart } from "@/veil/parts/keen/keen-heart";
import { StageThread } from "@/veil/parts/stage/stage-thread";
import { WhatsAppLink } from "@/veil/parts/whatsapp/whatsapp-link";
import { useFlasher, type FlashTarget } from "@/veil/shell/flash";

/**
 * Task 3.5's gallery section: every ledger row and its states, drawn from fixed
 * fake data held in the page. Nothing is saved anywhere. "Today" is 14 October
 * 2026 at 11:30 in Jakarta, as the design guide fixes it. The buttons flash a row
 * as the partner's change would, and the search marks the matches in the documents.
 */

const TODAY: IsoDate = "2026-10-14";
const NOW = Date.parse("2026-10-14T11:30:00+07:00");
const MINUTE = 60_000;

const FUNDERS: Funder[] = [
  { id: "greg", name: "Greg" },
  { id: "bella-fam", name: "Bella’s family" },
  { id: "ck", name: "CK" },
];

const part = (id: string, name: string, price: number, paid: number, funder: string | null, due: IsoDate | null, step = ""): Part => ({
  id,
  name,
  price,
  paid,
  funder,
  due,
  step,
});

const booking = (over: Partial<Booking> & Pick<Booking, "id" | "name">): Booking => ({
  kind: "vendor",
  recordId: over.id,
  category: "",
  price: 0,
  paid: 0,
  funder: null,
  due: null,
  step: "",
  parts: [],
  estimate: null,
  bookedOn: "2026-08-02",
  from: null,
  direct: false,
  ...over,
});

const BOOKINGS: Booking[] = [
  booking({
    id: "vendor-v1",
    name: "Pelaminan Ayu",
    category: "Decoration",
    estimate: 22_000_000,
    parts: [
      part("p-deposit", "Deposit", 5_000_000, 5_000_000, "greg", null),
      part("p-final", "Final payment", 20_000_000, 0, "bella-fam", "2026-10-30", "Pay the balance"),
    ],
  }),
  booking({ id: "vendor-v2", name: "Bu Sri’s catering", category: "Food", price: 55_500_000, paid: 55_500_000, funder: "ck" }),
  booking({
    id: "vendor-v3",
    name: "Dimas Studio",
    category: "Photography",
    price: 15_000_000,
    paid: 5_000_000,
    funder: "ck",
    due: "2026-10-10",
    step: "Second payment",
    estimate: 12_000_000,
  }),
  booking({ id: "venue-h1", name: "Hotel Ballroom", kind: "venue", price: 10_000_000, paid: 11_000_000, funder: null }),
  booking({ id: "vendor-v5", name: "Floral Studio", category: "Florist", funder: "greg" }),
  booking({
    id: "vendor-v6",
    name: "Make-up artist for the groom and bride’s mothers, with a very long name to see it wrap",
    category: "Beauty",
    parts: [
      part("m1", "Groom’s mother", 2_000_000, 0, null, "2026-10-18", "Pay the balance"),
      part("m2", "Bride’s mother", 2_000_000, 0, "ck", "2026-11-20", "Deposit"),
      part("m3", "Trial session", 1_000_000, 1_000_000, "greg", null),
      part("m4", "Wedding day", 3_000_000, 0, "greg", null),
      part("m5", "Hair", 1_000_000, 0, null, null),
      part("m6", "Extra hours", 500_000, 200_000, "ck", "2026-10-25"),
      part("m7", "Travel", 750_000, 0, "greg", null),
    ],
  }),
];

const WHAT_IFS: WhatIfItem[] = [
  { id: "w1", name: "Second photographer", category: "Photography", totalPrice: 3_000_000, funder: "bella-fam" },
  {
    id: "w2",
    name: "Grand hall upgrade",
    category: "Venue",
    totalPrice: 13_500_000,
    funder: null,
    subEntries: [
      { id: "s1", name: "Sound system", totalPrice: 4_000_000, funder: "greg" },
      { id: "s2", name: "Lighting", totalPrice: 6_000_000, funder: null },
      { id: "s3", name: "Extra hours", totalPrice: 2_500_000, funder: "ck" },
      { id: "s4", name: "Chairs", totalPrice: 1_000_000 },
    ],
  },
  { id: "w3", name: "Live band", category: "", totalPrice: 6_000_000, funder: null },
];

const VENDORS: VendorRowData[] = [
  { id: "v1", name: "Pelaminan Ayu", category: "Decoration", contact: "Bu Ayu", price: 25_000_000, optionCount: 3, rating: 4.8, reviewers: 120 },
  { id: "v2", name: "Studio Dimas", category: "Photography", contact: null, price: null, optionCount: 0, rating: null, reviewers: 0 },
  { id: "v3", name: "Bakery Manis", category: "Cake", contact: "0812 3456 7890", price: 4_500_000, optionCount: 1, rating: 5, reviewers: 1 },
  { id: "v4", name: "Organ and Co", category: "Music", contact: "Ibu Rina", price: 6_000_000, optionCount: 2, rating: 3.9, reviewers: 1200, ruledOut: true },
];

const VENUE: VendorRowData = { id: "h1", name: "Hotel Ballroom", category: "Venue", contact: "Front desk", price: 10_000_000, optionCount: 1, rating: null, reviewers: 0 };

/** Task 3.9's parts for each row: the stored stage, whether we're keen, and a number when there is one. */
const TRADE: Record<string, { stage: string; keen: boolean; phone?: string }> = {
  v1: { stage: "Chosen", keen: true },
  v2: { stage: "Inquiring", keen: false },
  v3: { stage: "Done", keen: false, phone: "0812 3456 7890" },
  v4: { stage: "Rejected", keen: false },
};

const DOCUMENTS: DocumentRowData[] = [
  {
    id: "d1",
    title: "Seating plan draft",
    text: "Table 1: Greg’s uncle Hendra Santoso and the bride’s aunt Lily. Table 2: the business clients, with the plus-ones kept together.",
    editedAt: NOW - 12 * MINUTE,
    editedBy: "Bella",
  },
  {
    id: "d2",
    title: "",
    text: "Notes from the venue visit: the terrace is free on the Saturday, and the generator is extra.",
    editedAt: NOW - 3 * 24 * 60 * MINUTE,
    editedBy: null,
  },
  {
    id: "d3",
    title: "Photographer contract",
    text: "The photographer arrives two hours before the ceremony and stays until the first dance. The deposit is Rp 5.000.000, paid by CK.",
    editedAt: NOW - 2 * 60 * MINUTE,
    editedBy: "Bella",
  },
  { id: "d4", title: "Vendor contracts 2026 and a long title that goes on for a while so that it wraps onto a second line", text: "", editedAt: null, editedBy: null },
];

const FILES: FileRowData[] = [
  { id: "f1", name: "Pelaminan contract.pdf", size: 2_400_000, date: "2026-10-02", category: "Contract", description: "Signed copy" },
  { id: "f2", name: "Moodboard.jpg", size: 800_000, date: "2026-09-18", thumb: "/icon-192.png" },
  { id: "f3", name: "Floor plan.xlsx", size: 150_000, date: "2026-10-14", category: null, description: null },
  { id: "f4", name: "Invoice 003.pdf", size: 3_000_000, date: "2026-10-01", category: "Invoice", path: ["Vendors", "Pelaminan Ayu"] },
];

const FOLDERS = [
  { id: "fo1", name: "Vendors", folders: 6, files: 12 },
  { id: "fo2", name: "Venue", folders: 0, files: 1 },
  { id: "fo3", name: "Empty folder", folders: 0, files: 0 },
];

const agendaEvent = (over: Partial<AgendaItem> & Pick<AgendaItem, "id" | "title" | "date" | "status">): AgendaItem => ({
  key: `event:${over.id}`,
  type: "event",
  kind: "vendor_call",
  start: "10:00",
  end: null,
  where: "",
  notes: "",
  relatedId: null,
  amount: null,
  funder: null,
  partId: null,
  steps: null,
  ...over,
});

const AGENDA: AgendaItem[] = [
  agendaEvent({ id: "e5", title: "Walk through the venue", date: "2026-10-12", status: "completed" }),
  agendaEvent({ id: "e6", title: "Cake tasting", date: "2026-10-17", start: "14:00", kind: "appointment", status: "cancelled" }),
];

const item = (over: Partial<ItemRecord> & Pick<ItemRecord, "id" | "item" | "sortOrder">): ItemRecord => ({
  vendor: "",
  confirmed: false,
  types: [],
  persons: ["General"],
  next: false,
  ...over,
});

const ITEMS: ItemRecord[] = [
  item({ id: "i1", item: "Wedding cake", sortOrder: 1, vendor: "Manis Bakery", types: ["Reception"], next: true }),
  item({ id: "i2", item: "Photo booth", sortOrder: 2, vendor: "Bespoke Tailor Bali", types: ["Reception"] }),
];

const TASK: TaskRecord = {
  id: "t4",
  title: "Order the rings",
  notes: "",
  dueDate: "2026-09-29",
  doneOn: "2026-09-29",
  done: true,
  subtasks: [],
};

/** The section's own address: the demo's links go back to it rather than to pages that aren't built yet. */
const HERE = "/gallery#section-3-5";

/** What the flash buttons flash, as the partner's change would. */
const FLASHES: { label: string; target: FlashTarget; said: string }[] = [
  { label: "Flash Pelaminan Ayu", target: { kind: "booking", id: "vendor-v1" }, said: "Flashed the Pelaminan Ayu entry" },
  {
    label: "Flash the final payment",
    target: { kind: "booking", id: "vendor-v1", partId: "p-final" },
    said: "Flashed the final payment",
  },
  { label: "Flash the vendor row", target: { kind: "vendor", id: "v1" }, said: "Flashed the Pelaminan Ayu vendor row" },
  { label: "Flash the contract", target: { kind: "file", id: "f1" }, said: "Flashed the contract file" },
];

export function LedgerDemos() {
  const flash = useFlasher();
  const [log, setLog] = useState("Nothing changed yet.");
  const [query, setQuery] = useState("");
  const dueRows = dues(BOOKINGS, TODAY);

  const say = (text: string) => setLog(text);

  return (
    <div>
      <p role="status">{log}</p>
      <p>
        {FLASHES.map((x) => (
          <button
            key={x.label}
            type="button"
            onClick={() => {
              flash(x.target);
              say(x.said);
            }}
          >
            {x.label}
          </button>
        ))}
      </p>

      <h3>Bookings</h3>
      <Ledger label="Bookings">
        {BOOKINGS.map((b) => (
          <BookingEntry key={b.id} booking={b} funders={FUNDERS} today={TODAY} />
        ))}
      </Ledger>

      <h3>What-if</h3>
      <Ledger label="What-if items">
        {WHAT_IFS.map((w) => (
          <WhatIfEntry
            key={w.id}
            item={w}
            funders={FUNDERS}
            onEdit={(x) => say(`Edit ${x.name}`)}
            onRemove={(x) => say(`Remove ${x.name}`)}
          />
        ))}
      </Ledger>

      <h3>Vendors and venues</h3>
      <Ledger label="Vendors">
        {VENDORS.map((v) => (
          <VendorRow
            key={v.id}
            vendor={v}
            href={HERE}
            showCategory
            shortlistHref={v.id === "v1" ? HERE : null}
            keen={<KeenHeart name={v.name} keen={TRADE[v.id].keen} />}
            stage={<StageThread kind="vendor" stage={TRADE[v.id].stage} />}
            whatsApp={<WhatsAppLink phone={TRADE[v.id].phone} />}
          />
        ))}
        <VendorRow
          vendor={VENUE}
          href={HERE}
          kind="venue"
          showCategory
          keen={<KeenHeart name={VENUE.name} keen={false} />}
          stage={<StageThread kind="venue" stage="Booked" />}
        />
      </Ledger>

      <h3>Payments due</h3>
      <Ledger label="Payments due">
        {dueRows.map((due) => (
          <DueRow
            key={`${due.booking.id}:${due.part.id ?? "booking"}`}
            due={due}
            funders={FUNDERS}
            today={TODAY}
            onRecordPayment={(x) => say(`Record a payment for ${x.booking.name}`)}
          />
        ))}
      </Ledger>

      <h3>Documents</h3>
      <p>
        <label>
          Search the documents{" "}
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      </p>
      <Ledger label="Documents">
        {DOCUMENTS.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} href={HERE} now={NOW} query={query} />
        ))}
      </Ledger>

      <h3>Files and folders</h3>
      <Ledger label="Folders">
        {FOLDERS.map((folder) => (
          <FolderRow key={folder.id} folder={folder} href={HERE} />
        ))}
      </Ledger>
      <Ledger label="Files">
        {FILES.map((file) => (
          <FileRow key={file.id} file={file} today={TODAY} onOpen={(x) => say(`Opened ${x.name}`)} />
        ))}
        <FileRow
          file={{ id: "f5", name: "Invoice 003.pdf", size: 3_000_000, date: "2026-10-01", category: "Invoice", path: ["Vendors", "Pelaminan Ayu"] }}
          today={TODAY}
          withPath
        />
      </Ledger>

      <h3>Row states</h3>
      <p>Ruled out: Organ and Co, in the vendor list above, is greyed and struck through, and its stage reads Ruled out.</p>
      <ul aria-label="Completed and cancelled" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {AGENDA.map((x) => (
          <AgendaRow key={x.key} item={x} today={TODAY} funderName={null} />
        ))}
      </ul>
      <ul aria-label="Done task" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        <TaskRow task={TASK} today={TODAY} actions={{}} />
      </ul>
      <ul aria-label="Item rows in a state" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        <ItemRow item={ITEMS[0]} actions={{}} reorderable={false} />
        <ItemRow item={ITEMS[1]} actions={{}} reorderable={false} failedFields={new Set(["vendor"] as const)} />
      </ul>
      <p>Empty meta keeps its height: no category or funder on Hotel Ballroom, no contact on Studio Dimas, an untitled document with no words, a file with no category or description.</p>
    </div>
  );
}
