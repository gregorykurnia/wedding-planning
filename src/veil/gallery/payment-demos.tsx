"use client";

import { useState } from "react";
import { useBookings } from "@/lib/data/use-bookings";
import type { UploadDeps } from "@/lib/data/upload-queue";
import type { Booking } from "@/lib/model/bookings";
import { rp } from "@/lib/model/format";
import type { Funder } from "@/lib/model/money";
import { Btn } from "@/veil/parts/actions/btn";
import { RecordPaymentSheet, type RecordFn } from "@/veil/parts/payment/record-payment-sheet";
import { useRecordPayment } from "@/veil/parts/payment/use-record-payment";
import { useSheets } from "@/veil/shell/sheet";
import galleryStyles from "./gallery.module.css";

// Task 4.4: Record a payment (guide §5.4). Against the Firebase emulators
// (NEXT_PUBLIC_USE_EMULATORS=1) the buttons open the real sheet on the
// emulator's bookings, with the real write and the real upload pipeline.
// Everywhere else they open it on fixed fake bookings and a stand-in write held
// in this page, so a gallery visit never writes real data.

const USE_EMULATOR = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

const FUNDERS: Funder[] = [
  { id: "greg", name: "Greg" },
  { id: "bella", name: "Bella" },
  { id: "family", name: "Bella’s family" },
];

const line = (name: string, price: number, paid: number, funder: string | null, due: string | null) => ({
  id: null,
  name,
  price,
  paid,
  funder,
  due,
  step: "",
});

const booking = (id: string, name: string, price: number, paid: number, parts: Booking["parts"] = []): Booking => ({
  id: `vendor-${id}`,
  kind: "vendor",
  recordId: id,
  name,
  category: "Catering",
  price,
  paid,
  funder: "greg",
  due: "2026-10-30",
  step: "",
  parts,
  estimate: null,
  bookedOn: null,
  from: "vendor",
  direct: false,
});

const START: Booking[] = [
  booking("catering", "Dapur Lestari Catering", 30_000_000, 10_000_000),
  booking("villa", "Villa Samaya Ubud", 50_000_000, 25_000_000, [
    { ...line("Deposit", 25_000_000, 25_000_000, "family", null), id: "deposit" },
    { ...line("Balance", 25_000_000, 0, "family", "2026-10-30"), id: "balance" },
  ]),
  booking("florist", "Bunga Melati Florist", 5_000_000, 5_000_000),
];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Flags = { fail: boolean; slow: boolean };

/** A stand-in receipt pipeline: it sends quickly, or never finishes for a name with "hold". */
function standInDeps(flags: () => Flags): UploadDeps {
  let count = 0;
  return {
    shrink: async (file) => file,
    send: async (file, onProgress) => {
      const total = file.size || 1000;
      onProgress(Math.round(total * 0.4), total);
      await pause(flags().slow ? 600 : 20);
      if (file.name.includes("hold")) await new Promise<never>(() => {});
      if (file.name.includes("fail") || flags().fail) throw new Error("Upload failed");
      onProgress(total, total);
      return { publicId: `gallery/${file.name}`, url: `https://example.com/${encodeURIComponent(file.name)}`, resourceType: "auto", format: "", bytes: total };
    },
    save: async ({ docId }) => docId,
    rename: async () => {},
    newDocId: () => `receipt-${++count}`,
  };
}

const withPaid = (b: Booking, partId: string | null, change: number): Booking =>
  partId
    ? { ...b, parts: b.parts.map((p) => (p.id === partId ? { ...p, paid: p.paid + change } : p)) }
    : { ...b, paid: b.paid + change };

// The demo's switches, read by the stand-ins when they run (one gallery on the page).
const FLAGS: Flags = { fail: false, slow: false };

export function PaymentDemos() {
  const sheets = useSheets();
  const openReal = useRecordPayment();
  const real = useBookings();
  const [fakes, setFakes] = useState(START);
  const [demo, setDemo] = useState(false);
  const [deps] = useState(() => standInDeps(() => FLAGS));

  const rows = USE_EMULATOR ? (real.data ?? []) : fakes;

  const standIn =
    (id: string): RecordFn =>
    async ({ amount }, { partId }) => {
      await pause(FLAGS.slow ? 1500 : 300);
      if (FLAGS.fail) {
        FLAGS.fail = false;
        throw new Error("The write failed");
      }
      setFakes((all) => all.map((b) => (b.id === id ? withPaid(b, partId, amount) : b)));
      return {
        undo: async () => {
          await pause(300);
          setFakes((all) => all.map((b) => (b.id === id ? withPaid(b, partId, -amount) : b)));
        },
      };
    };

  const open = (b: Booking, partId: string | null) => {
    if (USE_EMULATOR) return openReal(b, partId);
    const current = fakes.find((f) => f.id === b.id) ?? b;
    sheets.open(
      <RecordPaymentSheet
        booking={current}
        partId={partId}
        funders={FUNDERS}
        record={standIn(b.id)}
        uploadDeps={deps}
        demo={demo}
      />,
    );
  };

  return (
    <div className={galleryStyles.demo}>
      <div className={galleryStyles.controls} role="group" aria-label="Demo switches">
        <label>
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Demonstration mode
        </label>
        <label>
          <input type="checkbox" onChange={(e) => (FLAGS.fail = e.target.checked)} /> Make the next write or
          upload fail
        </label>
        <label>
          <input type="checkbox" onChange={(e) => (FLAGS.slow = e.target.checked)} /> Slow writes
        </label>
      </div>
      <ul aria-label="Bookings">
        {rows.map((b) => (
          <li key={b.id}>
            <b dir="auto">{b.name}</b>: paid <span className="num">{rp(b.parts.length ? b.parts.reduce((s, p) => s + p.paid, 0) : b.paid)}</span>
            {b.parts.length > 0 ? (
              b.parts.map((p) => (
                <span key={p.id}>
                  {" "}
                  <Btn variant="quiet" small onClick={() => open(b, p.id)}>
                    Record payment on {p.name}
                  </Btn>
                </span>
              ))
            ) : (
              <>
                {" "}
                <Btn variant="quiet" small onClick={() => open(b, null)}>
                  Record payment for {b.name}
                </Btn>
              </>
            )}
          </li>
        ))}
      </ul>
      {!USE_EMULATOR && (
        <p className={galleryStyles.note}>Writes here go to a stand-in held in this page. Against the emulators they are real.</p>
      )}
    </div>
  );
}
