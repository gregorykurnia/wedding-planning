"use client";

import { useState } from "react";
import type { IsoDate, Part } from "@/lib/model/bookings";
import { CarryLines, type CarryRow } from "@/veil/parts/menu-card/carry-lines";
import { MenuCardList, type MenuOption } from "@/veil/parts/menu-card/menu-card-list";
import { partLineList, type PartLine } from "@/veil/parts/menu-card/menu-text";
import { PackageLines, type PackageLine } from "@/veil/parts/menu-card/package-lines";
import { PartDisclosure } from "@/veil/parts/menu-card/part-disclosure";
import { PartLines } from "@/veil/parts/menu-card/part-lines";
import { Tally, type TallyRow } from "@/veil/parts/menu-card/tally";

/**
 * Task 3.6's gallery section: parts in a ledger (every tone, a collapsed list and
 * a what-if list), a booking's part disclosures, price options and categories as
 * menu cards, packages, the headcount tally and the carry lines, drawn from fixed
 * fake data. "Today" is 14 October 2026, as in 3.11's section.
 */

const TODAY: IsoDate = "2026-10-14";

const FUNDERS: Record<string, string> = { ck: "CK", gregory: "Gregory", bella: "Bella" };
const funderName = (id: string | null) => (id ? FUNDERS[id] : "Not assigned");

/** Every status: paid in full, late, due with a date, no date and overpaid. */
const FIVE_PARTS: Part[] = [
  { id: "deposit", name: "Deposit", price: 25_000_000, paid: 25_000_000, funder: "ck", due: "2026-09-01", step: "" },
  { id: "balance", name: "Balance", price: 25_000_000, paid: 0, funder: "gregory", due: "2026-10-10", step: "Send the transfer" },
  { id: "final", name: "Final payment", price: 30_000_000, paid: 10_000_000, funder: "bella", due: "2026-10-30", step: "" },
  { id: "extra", name: "Extra hour", price: 5_000_000, paid: 0, funder: null, due: null, step: "" },
  { id: "top-up", name: "Deposit top-up", price: 1_000_000, paid: 2_000_000, funder: "ck", due: null, step: "" },
];

/** Seven parts: the first four still owing are shown, then "and 3 more parts". */
const SEVEN_PARTS: Part[] = [
  { id: "a", name: "Venue deposit", price: 20_000_000, paid: 20_000_000, funder: "ck", due: "2026-08-01", step: "" },
  { id: "b", name: "Catering, first instalment", price: 20_000_000, paid: 0, funder: "ck", due: "2026-10-20", step: "" },
  { id: "c", name: "Flowers", price: 4_000_000, paid: 4_000_000, funder: "bella", due: null, step: "" },
  { id: "d", name: "Catering, second instalment", price: 20_000_000, paid: 0, funder: "ck", due: "2026-11-05", step: "" },
  { id: "e", name: "Photographer", price: 12_000_000, paid: 0, funder: "gregory", due: "2026-11-15", step: "" },
  { id: "f", name: "Band", price: 15_000_000, paid: 0, funder: null, due: "2026-12-01", step: "" },
  { id: "g", name: "Lighting", price: 6_000_000, paid: 0, funder: "bella", due: null, step: "" },
];

const HYPOTHETICAL: PartLine[] = [
  { key: "photo", name: "Photo booth", value: "Rp 8.000.000, Bella", tone: "plain" },
  { key: "band", name: "Band for the reception", value: "Rp 15.000.000, no funder yet", tone: "plain" },
];

const PRICE_OPTIONS: MenuOption[] = [
  { id: "silver", name: "Silver package", price: 45_000_000, includes: "Up to 150 guests, two chefs and a tasting" },
  {
    id: "gold",
    name: "Gold package",
    price: 62_500_000,
    includes: "Up to 250 guests, four chefs, a tasting and a dessert station",
    preferred: true,
  },
  { id: "custom", name: "Build your own", price: 38_000_000 },
];

const CATEGORIES: MenuOption[] = [
  { id: "sound", name: "Sound and lights" },
  { id: "stationery", name: "Stationery" },
];

const PACKAGES: PackageLine[] = [
  { id: "half", name: "Half day", price: 18_000_000 },
  { id: "full", name: "Full day", price: 26_500_000, preferred: true },
];

const TALLY: TallyRow[] = [
  { label: "Both events", count: 142 },
  { label: "Reception", count: 168 },
  { label: "of which, if space allows", count: 21, tone: "of-which" },
  { label: "Ceremony", count: 96 },
  { label: "Unsure, living abroad", count: 7, tone: "apart" },
];

/** Eight funders are shown; the ninth is counted in "and 1 more funder". */
const CARRY: CarryRow[] = [
  { key: "ck", label: "CK", amount: 12_000_000 },
  { key: "gregory", label: "Gregory", amount: 9_500_000 },
  { key: "bella", label: "Bella", amount: 4_000_000 },
  { key: "none", label: "Not assigned yet", amount: 3_000_000 },
  { key: "bella-fam", label: "Bella Fam", amount: 2_500_000 },
  { key: "ratna", label: "Auntie Ratna", amount: 1_500_000 },
  { key: "dimas", label: "Oom Dimas", amount: 1_000_000 },
  { key: "office", label: "Office fund", amount: 750_000 },
];

export function PartsDemos() {
  const [options, setOptions] = useState(PRICE_OPTIONS);
  const [categories, setCategories] = useState(CATEGORIES);
  const [note, setNote] = useState("");

  return (
    <div>
      <h3>Parts in a ledger row</h3>
      <PartLines {...partLineList(FIVE_PARTS, TODAY)} />

      <h3>Over five parts: the first four still owing, then the rest</h3>
      <PartLines {...partLineList(SEVEN_PARTS, TODAY)} />

      <h3>What-if money</h3>
      <PartLines hypothetical lines={HYPOTHETICAL} more={0} />

      <h3>Parts on a booking</h3>
      <ul aria-label="Parts on the booking" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {FIVE_PARTS.map((part) => (
          <PartDisclosure
            key={part.id}
            part={part}
            today={TODAY}
            funder={funderName(part.funder)}
            defaultOpen={part.id === "balance"}
          >
            <p>The part’s fields, files and actions go here.</p>
          </PartDisclosure>
        ))}
      </ul>

      <h3>Price options</h3>
      <MenuCardList
        options={options}
        onLean={(option) => setOptions((all) => all.map((o) => ({ ...o, preferred: o.id === option.id })))}
        onEdit={(option) => setNote(`Editing ${option.name}`)}
        onRemove={(option) => setOptions((all) => all.filter((o) => o.id !== option.id))}
      />

      <h3>Categories</h3>
      <MenuCardList
        options={categories}
        onEdit={(option) => setNote(`Editing ${option.name}`)}
        onRemove={(option) => setCategories((all) => all.filter((c) => c.id !== option.id))}
      />
      <p role="status">{note}</p>

      <h3>Packages on a finalist</h3>
      <PackageLines packages={PACKAGES} />

      <h3>Headcounts</h3>
      <Tally rows={TALLY} />

      <h3>Who would pay the extra</h3>
      <CarryLines rows={CARRY} more={1} />
    </div>
  );
}
