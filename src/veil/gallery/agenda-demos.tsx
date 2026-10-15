"use client";

import { useMemo, useState } from "react";
import {
  agendaGroups,
  agendaItems,
  itemsOn,
  monthCells,
  type AgendaItem,
  type EventRecord,
} from "@/lib/model/agenda";
import { bookingsFrom, type VendorRecord } from "@/lib/model/bookings";
import { addMonths } from "@/lib/model/dates";
import { dues } from "@/lib/model/money";
import type { TaskRecord } from "@/lib/model/tasks";
import { AgendaGroup } from "@/veil/parts/agenda/agenda-group";
import { AgendaRow } from "@/veil/parts/agenda/agenda-row";
import { MonthCalendar } from "@/veil/parts/month/month-calendar";

/**
 * Task 3.11's gallery section: agenda groups and rows, and the month grid, drawn
 * from the model with fixed fake data. "Today" is 14 October 2026 so every
 * variant is on screen in the same place; the wedding is on 31 October.
 */

const TODAY = "2026-10-14";
const WEDDING = "2026-10-31";

const event = (over: Partial<EventRecord> & Pick<EventRecord, "id" | "title" | "startAt">): EventRecord => ({
  type: "appointment",
  endAt: null,
  allDay: false,
  notes: "",
  location: "",
  status: "scheduled",
  relatedVendorId: null,
  relatedVenueId: null,
  reminderMinutes: [],
  ...over,
});

const EVENTS: EventRecord[] = [
  event({
    id: "e1",
    title: "Call with Laras about the arch",
    type: "vendor_call",
    startAt: "2026-10-14T15:00",
    endAt: "2026-10-14T15:30",
    location: "https://meet.google.com/kbn-arch-call",
    relatedVendorId: "kebun",
  }),
  event({
    id: "e2",
    title: "Tasting at Sendok Emas",
    startAt: "2026-10-16T11:00",
    endAt: "2026-10-16T12:30",
    location: "Jl. Raya Kerobokan 88, Kerobokan",
    relatedVendorId: "sendok",
  }),
  event({ id: "e3", title: "Organiser check-in", type: "organiser_call", startAt: "2026-10-20T19:00", location: "WhatsApp video" }),
  event({ id: "e4", title: "Sign the photographer’s contract", type: "deadline", startAt: "2026-10-11", allDay: true }),
  event({ id: "e5", title: "Walk through the venue", startAt: "2026-10-12T10:00", status: "completed" }),
  event({ id: "e6", title: "Cake tasting", startAt: "2026-10-17T14:00", status: "cancelled" }),
  event({ id: "e7", title: "Transfer the band’s deposit", type: "payment", startAt: "2026-10-14", allDay: true }),
  event({
    id: "e8",
    title: "Bring both mums to the fitting at Butik Cantik Pernikahan Indonesia Jalan Raya Kerobokan Nomor 88",
    startAt: "2026-10-22T09:30",
    location: "Butik Cantik, Jl. Raya Kerobokan 88, Kerobokan Kelod, Kuta Utara, Badung",
    relatedVenueId: "villa",
  }),
  event({ id: "e9", title: "Fitting", startAt: "2026-10-16T09:00" }),
  event({ id: "e10", title: "Pick up the flowers", startAt: "2026-10-16T16:00" }),
  event({ id: "e11", title: "Call the priest", type: "vendor_call", startAt: "2026-10-16T18:00" }),
  event({ id: "e12", title: "Wedding day", type: "other", startAt: WEDDING, allDay: true }),
];

const vendor = (over: Partial<VendorRecord> & Pick<VendorRecord, "id" | "name">): VendorRecord => ({
  category: "Food",
  contractStatus: "Chosen",
  funder: "CK",
  totalPrice: 100_000_000,
  budgetSpent: 40_000_000,
  nextTargetDate: null,
  nextAction: "",
  subEntries: [],
  ...over,
});

const VENDORS: VendorRecord[] = [
  vendor({ id: "catering", name: "Dapur Lestari Catering", nextTargetDate: "2026-10-20" }),
  vendor({ id: "photo", name: "Kirana Photography", category: "Photo", funder: "Bella", totalPrice: 30_000_000, budgetSpent: 10_000_000, nextTargetDate: "2026-10-10" }),
  vendor({
    id: "decor",
    name: "Kebun Dekor",
    category: "Decor",
    funder: null,
    subEntries: [
      { id: "p1", name: "Deposit", funder: "Gregory", totalPrice: 20_000_000, budgetSpent: 0, nextTargetDate: "2026-10-16", nextAction: "" },
      { id: "p2", name: "Final Payment", funder: "Gregory", totalPrice: 40_000_000, budgetSpent: 0, nextTargetDate: "2026-11-05", nextAction: "" },
    ],
  }),
];

const TASKS: TaskRecord[] = [
  {
    id: "t1",
    title: "Book the honeymoon flights",
    notes: "",
    dueDate: "2026-10-25",
    done: false,
    subtasks: [
      { id: "s1", title: "Pick the dates", dueDate: null, done: true },
      { id: "s2", title: "Check the passports", dueDate: null, done: true },
      { id: "s3", title: "Buy the tickets", dueDate: null, done: false },
    ],
  },
  { id: "t2", title: "Send the save-the-dates", notes: "", dueDate: "2026-10-12", done: false, subtasks: [] },
];

const FUNDERS: Record<string, string> = { CK: "CK", Gregory: "Gregory", Bella: "Bella" };
const RELATED: Record<string, { name: string; href: string }> = {
  kebun: { name: "Kebun Dekor", href: "/new/vendors/kebun" },
  sendok: { name: "Sendok Emas", href: "/new/vendors/sendok" },
  villa: { name: "Villa Samaya Ubud, venue", href: "/new/vendors/venues" },
};

const funderNameOf = (item: AgendaItem) => FUNDERS[item.funder ?? ""] ?? null;
const relatedOf = (item: AgendaItem) => (item.relatedId ? (RELATED[item.relatedId] ?? null) : null);

export function AgendaDemos() {
  const [month, setMonth] = useState({ year: 2026, month: 10 });
  const [day, setDay] = useState<string>(TODAY);
  const [log, setLog] = useState("Nothing pressed yet.");

  const items = useMemo(() => agendaItems(EVENTS, dues(bookingsFrom(VENDORS, []), TODAY), TASKS), []);
  const groups = useMemo(() => agendaGroups(items, TODAY), [items]);
  const cells = monthCells({ ...month, items, today: TODAY, selected: day, wedding: WEDDING });
  const chosen = itemsOn(items, day);

  const onOpen = (item: AgendaItem) => setLog(`Opened the event ${item.title}`);
  const onRecordPayment = (item: AgendaItem) => setLog(`Record payment for ${item.title}`);

  return (
    <div>
      <p role="status">{log}</p>

      <h3>Agenda groups</h3>
      <div aria-label="Agenda groups">
        {groups.map((group) => (
          <AgendaGroup
            key={group.key}
            group={group}
            today={TODAY}
            onOpen={onOpen}
            onRecordPayment={onRecordPayment}
            relatedOf={relatedOf}
            funderNameOf={funderNameOf}
          />
        ))}
      </div>

      <h3>Month</h3>
      <MonthCalendar
        {...month}
        cells={cells}
        today={TODAY}
        onPick={setDay}
        onEarlier={() => setMonth(({ year, month: m }) => addMonths(year, m, -1))}
        onLater={() => setMonth(({ year, month: m }) => addMonths(year, m, 1))}
        onToday={() => {
          setMonth({ year: 2026, month: 10 });
          setDay(TODAY);
        }}
      />
      <h3>The chosen day</h3>
      {chosen.length ? (
        <ul aria-label="The chosen day" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {chosen.map((item) => (
            <AgendaRow
              key={item.key}
              item={item}
              today={TODAY}
              onOpen={onOpen}
              onRecordPayment={onRecordPayment}
              related={relatedOf(item)}
              funderName={funderNameOf(item)}
            />
          ))}
        </ul>
      ) : (
        <p>Nothing on this day.</p>
      )}
    </div>
  );
}
