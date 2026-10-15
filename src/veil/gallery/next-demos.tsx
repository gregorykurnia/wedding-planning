"use client";

import { useState } from "react";
import type { Booking, Part } from "@/lib/model/bookings";
import { plural } from "@/lib/model/format";
import { dues } from "@/lib/model/money";
import { veilHref } from "@/veil/href";
import { Doors, type DoorItem } from "@/veil/parts/doors/doors";
import { AfterLine, NextCard } from "@/veil/parts/next-card/next-card";

/**
 * Task 3.2's section of the component gallery: the next card in each state, its
 * after line and the doors, with fixed fake data. Today is fixed at 14 October
 * 2026, so the flags don't drift. The e2e test in tests/e2e/demo/veil-next.spec.ts
 * checks how they look at both widths.
 */

const TODAY = "2026-10-14";

const FUNDERS = [
  { id: "ck", name: "CK" },
  { id: "greg", name: "Gregory" },
  { id: "bella", name: "Bella" },
];

function booking(id: string, name: string, category: string, extra: Partial<Booking> = {}): Booking {
  return {
    id,
    kind: "vendor",
    recordId: id,
    name,
    category,
    price: 0,
    paid: 0,
    funder: null,
    due: null,
    step: "",
    parts: [],
    estimate: null,
    bookedOn: null,
    from: "vendor",
    direct: false,
    ...extra,
  };
}

function part(id: string, name: string, price: number, paid: number, funder: string | null, due: string): Part {
  return { id, name, price, paid, funder, due, step: "" };
}

/** The dues the model gives for these bookings, earliest first, as the screen would pass them. */
function duesOf(bookings: Booking[]) {
  const list = dues(bookings, TODAY);
  return {
    next: list[0] ?? null,
    after: list[1] ?? null,
    lateCount: list.filter((due) => due.urgency === "late").length,
  };
}

const BUDGET_DOORS: DoorItem[] = [
  {
    id: "bookings",
    name: "Bookings",
    href: veilHref("/budget/bookings"),
    summary: [{ text: "4 bookings, " }, { text: "1 overpaid", attention: true }],
  },
  {
    id: "payments",
    name: "Payments due",
    href: veilHref("/budget/payments"),
    summary: [{ text: "1 late", attention: true }, { text: ", 6 payments until March" }],
  },
  {
    id: "who-pays",
    name: "Who pays",
    href: veilHref("/budget/who-pays"),
    summary: [{ text: "CK, Gregory and Bella, Rp 12.500.000 not assigned" }],
  },
  {
    id: "what-if",
    name: "What-if items",
    href: veilHref("/budget/what-if"),
    summary: [{ text: "Would bring the total to Rp 1.020.000.000" }],
  },
];

const OVERVIEW_DOORS: DoorItem[] = [
  {
    id: "budget",
    name: "Budget",
    href: veilHref("/budget"),
    summary: [{ text: "Rp 473.150.000 paid of Rp 882.800.000" }],
  },
  { id: "tasks", name: "Tasks", href: veilHref("/schedule/tasks"), summary: [{ text: "3 of 12 tasks done" }] },
  {
    id: "guests",
    name: "Guests",
    href: veilHref("/guests"),
    summary: [{ text: "40 attending of 60 guests invited" }],
  },
  { id: "items", name: "Wedding items", href: veilHref("/items"), summary: [{ text: "Nothing tracked yet" }] },
];

/** One card, with its after line when a second payment is due. */
function CardVariant({
  title,
  bookings,
  onRecord,
}: {
  title: string;
  bookings: Booking[];
  onRecord: () => void;
}) {
  const { next, after, lateCount } = duesOf(bookings);
  return (
    <>
      <h3>{title}</h3>
      <NextCard today={TODAY} next={next} lateCount={lateCount} funders={FUNDERS} onRecord={onRecord} />
      {after ? <AfterLine due={after} today={TODAY} /> : null}
    </>
  );
}

export function NextDemos() {
  const [presses, setPresses] = useState(0);
  const onRecord = () => setPresses((count) => count + 1);

  return (
    <>
      <CardVariant
        title="Three late, the first one shown"
        onRecord={onRecord}
        bookings={[
          booking("vendor-catering", "Dapur Lestari Catering", "Catering", { price: 55_500_000, funder: "ck", due: "2026-10-09" }),
          booking("vendor-florist", "Kirana Florist", "Flowers", { price: 18_000_000, funder: "greg", due: "2026-10-11" }),
          booking("vendor-chairs", "Sewa Kursi Mekar", "Furniture", { price: 12_000_000, funder: "bella", due: "2026-10-12" }),
        ]}
      />

      <CardVariant
        title="One late, a single day"
        onRecord={onRecord}
        bookings={[booking("vendor-photo", "Lensa Senja", "Photography", { price: 8_000_000, funder: "bella", due: "2026-10-13" })]}
      />

      <CardVariant
        title="Due in 4 days, a part's name, then a later one"
        onRecord={onRecord}
        bookings={[
          booking("vendor-decor", "Pelaminan Ayu", "Decoration", {
            parts: [
              part("deposit", "Deposit", 10_000_000, 10_000_000, "ck", "2026-08-01"),
              part("final", "Final payment", 15_000_000, 0, "greg", "2026-10-18"),
            ],
          }),
          booking("vendor-band", "Sahabat Musik", "Music", { price: 12_000_000, funder: "bella", due: "2026-12-02" }),
        ]}
      />

      <CardVariant
        title="Due later, no category and no funder yet"
        onRecord={onRecord}
        bookings={[booking("vendor-venue", "Taman Cempaka", "", { price: 30_000_000, paid: 5_000_000, due: "2026-12-02" })]}
      />

      <CardVariant title="Nothing due" onRecord={onRecord} bookings={[]} />

      <p className="num">Record payment pressed {plural(presses, "time")}</p>

      <h3>The doors on the budget</h3>
      <Doors doors={BUDGET_DOORS} />

      <h3>The doors on the overview</h3>
      <Doors doors={OVERVIEW_DOORS} />
    </>
  );
}
