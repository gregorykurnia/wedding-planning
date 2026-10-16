"use client";

import { useState } from "react";
import { readAmount } from "@/lib/model/amount";
import { n0, rp } from "@/lib/model/format";
import { VENUE_RULED_OUT, VENUE_STAGES, venueStageLabel } from "@/lib/model/labels";
import {
  ITEM_ORDERS,
  VENDOR_ORDERS,
  VENUE_ORDERS,
  orderItems,
  orderVendors,
  orderVenues,
  paging,
  type ItemOrderKey,
  type VendorOrderKey,
  type VenueOrderKey,
} from "@/lib/model/order";
import {
  NO_VENDOR_FILTER,
  NO_VENUE_FILTER,
  filterVendors,
  filterVenues,
  isFilteringVendors,
  isFilteringVenues,
  type VenueFilter,
} from "@/lib/model/search";
import { CountLine, ShowMore, SortedNote } from "@/veil/parts/tools/results";
import { FilterCheck, RangeField, ShowEverything } from "@/veil/parts/tools/filters";
import { SearchField } from "@/veil/parts/tools/search-field";
import { FilterSelect, OrderBy, type OrderState } from "@/veil/parts/tools/selects";
import { FilterBar, Toggles, Toolbar } from "@/veil/parts/tools/toolbar";
import { hereText, matchText, ofText, pagedText, showingOfText, totalText } from "@/veil/parts/tools/tools-text";

// Invented names and figures: the gallery shows the components, not real data.

const CATEGORIES = ["Catering", "Flowers", "Music", "Photography"];

type DemoVendor = {
  name: string;
  category: string;
  contactName: string;
  notes: string;
  starred: boolean;
  contractStatus: string;
  bridestoryRating: number | null;
  bridestoryReviewCount: number | null;
  createdAt: number;
};

const VENDORS: DemoVendor[] = [
  { name: "Harbour Table Catering", category: "Catering", contactName: "Stella", notes: "Buffet for 200. Tasting in March.", starred: true, contractStatus: "Inquiring", bridestoryRating: 4.8, bridestoryReviewCount: 96, createdAt: 3 },
  { name: "Lantern and Lace Florist", category: "Flowers", contactName: "Ibu Ratna", notes: "Peonies in season only", starred: false, contractStatus: "Consideration", bridestoryRating: 4.6, bridestoryReviewCount: 41, createdAt: 1 },
  { name: "Little Bell Strings", category: "Music", contactName: "Mas Dimas", notes: "Duo for the ceremony", starred: true, contractStatus: "List", bridestoryRating: 4.9, bridestoryReviewCount: 12, createdAt: 2 },
  { name: "Paper Moon Studio", category: "Photography", contactName: "Yuni", notes: "Second shooter extra", starred: false, contractStatus: "Chosen", bridestoryRating: 4.7, bridestoryReviewCount: 230, createdAt: 5 },
  { name: "Sunday Sound", category: "Music", contactName: "Rama", notes: "", starred: false, contractStatus: "Rejected", bridestoryRating: null, bridestoryReviewCount: null, createdAt: 4 },
  { name: "Fig and Thyme Cakes", category: "Catering", contactName: "Nadia", notes: "Tiered cake, not fondant", starred: false, contractStatus: "List", bridestoryRating: 4.5, bridestoryReviewCount: 18, createdAt: 6 },
  { name: "Gold Petal Flowers", category: "Flowers", contactName: "Pak Hendra", notes: "Market flowers are cheaper", starred: true, contractStatus: "Inquiring", bridestoryRating: 4.2, bridestoryReviewCount: 7, createdAt: 7 },
  { name: "Brightside Photo", category: "Photography", contactName: "Kevin", notes: "Drone add-on", starred: false, contractStatus: "Done", bridestoryRating: 4.4, bridestoryReviewCount: 55, createdAt: 8 },
];

type DemoVenue = {
  name: string;
  location: string;
  notes: string;
  status: string;
  budgetEstimate: number;
  guestMax: number;
};

const VENUES: DemoVenue[] = [
  { name: "Garden Pavilion", location: "Kemang", notes: "Outdoor backup tent", status: "Toured", budgetEstimate: 45000000, guestMax: 250 },
  { name: "Riverside Hall", location: "Menteng", notes: "", status: "Shortlist", budgetEstimate: 80000000, guestMax: 400 },
  { name: "Old Warehouse", location: "Tebet", notes: "Loud after nine", status: "Contacted", budgetEstimate: 30000000, guestMax: 180 },
  { name: "Terrace Room", location: "Senopati", notes: "Booked for Saturdays", status: "Booked", budgetEstimate: 60000000, guestMax: 150 },
  { name: "Harbour Club", location: "Ancol", notes: "", status: VENUE_RULED_OUT, budgetEstimate: 0, guestMax: 300 },
  { name: "Hill House", location: "Lembang", notes: "Two hours away", status: "Shortlist", budgetEstimate: 25000000, guestMax: 120 },
  { name: "Glasshouse", location: "Cikini", notes: "Air-conditioned", status: "Toured", budgetEstimate: 95000000, guestMax: 350 },
  { name: "Courtyard Ballroom", location: "Thamrin", notes: "Parking included", status: "Contacted", budgetEstimate: 0, guestMax: 500 },
];

const ITEMS = [
  { item: "Akad décor", vendor: "Gold Petal Flowers", confirmed: true, types: ["Matrimony"], persons: ["Bride"], next: false, sortOrder: 0 },
  { item: "Bridal bouquet", vendor: "Lantern and Lace Florist", confirmed: false, types: ["Both"], persons: ["Bride"], next: true, sortOrder: 1 },
  { item: "Suits for the groom’s family", vendor: "Atelier Nine", confirmed: false, types: ["Reception"], persons: ["Groom"], next: false, sortOrder: 2 },
  { item: "Ceremony music", vendor: "Little Bell Strings", confirmed: true, types: ["Matrimony"], persons: [], next: false, sortOrder: 3 },
  { item: "Guest favours", vendor: "", confirmed: false, types: ["Reception"], persons: ["Couple"], next: false, sortOrder: 4 },
];

/** How a screen words the count above a list: all of it, or the first few. */
function countWords(total: number, shown: number, filtering: boolean, noun: string) {
  if (shown < total) return filtering ? showingOfText(shown, total) : pagedText(total, shown, noun);
  return filtering ? hereText(total, noun) : totalText(total, noun);
}

function VendorsDemo() {
  const [query, setQuery] = useState("");
  const [keen, setKeen] = useState(false);
  const [order, setOrder] = useState<OrderState<VendorOrderKey>>({ key: "name", direction: "asc" });

  const filter = { ...NO_VENDOR_FILTER, query, keen };
  const rows = orderVendors(filterVendors(VENDORS, filter), order.key, order.direction, CATEGORIES);
  const filtering = isFilteringVendors(filter);

  return (
    <>
      <h3>Search, a filter and an order</h3>
      <Toolbar>
        <SearchField
          label="Search vendors"
          placeholder="Search names, contacts and notes"
          value={query}
          onChange={setQuery}
        />
        <Toggles>
          <FilterCheck label="Only ones we're keen on" checked={keen} onChange={setKeen} />
          <OrderBy choices={VENDOR_ORDERS} order={order} onChange={setOrder} />
        </Toggles>
      </Toolbar>
      <FilterBar>
        <ShowEverything
          filtering={filtering}
          onClear={() => {
            setQuery("");
            setKeen(false);
          }}
        />
      </FilterBar>
      <CountLine>{filtering ? hereText(rows.length, "vendor") : totalText(rows.length, "vendor")}</CountLine>
      <ul>
        {rows.map((vendor) => (
          <li key={vendor.name}>{vendor.name}</li>
        ))}
      </ul>
    </>
  );
}

const PAGE = 3;

function VenuesDemo() {
  const [filter, setFilter] = useState<VenueFilter>(NO_VENUE_FILTER);
  const [order, setOrder] = useState<OrderState<VenueOrderKey>>({ key: "cost", direction: "desc" });
  const [shown, setShown] = useState(PAGE);

  const update = (patch: Partial<VenueFilter>) => setFilter((current) => ({ ...current, ...patch }));
  const rows = orderVenues(filterVenues(VENUES, filter), order.key, order.direction);
  const { visible, more } = paging(rows.length, shown, PAGE);
  const filtering = isFilteringVenues(filter);

  return (
    <>
      <h3>Filters, a count and paging</h3>
      <Toolbar>
        <SearchField
          label="Search venues"
          placeholder="Search names, places and notes"
          value={filter.query}
          onChange={(query) => update({ query })}
        />
        <Toggles>
          <OrderBy choices={VENUE_ORDERS} order={order} onChange={setOrder} />
        </Toggles>
      </Toolbar>
      <Toolbar continued>
        <FilterSelect
          label="Stage"
          value={filter.stage}
          options={[
            { value: "", label: "Any" },
            ...VENUE_STAGES,
            { value: VENUE_RULED_OUT, label: venueStageLabel(VENUE_RULED_OUT) },
          ]}
          onChange={(stage) => update({ stage })}
        />
        <RangeField
          label="Costs at most"
          value={filter.maxCost}
          read={readAmount}
          show={rp}
          onChange={(maxCost) => update({ maxCost })}
        />
        <RangeField
          label="Holds at least"
          unit="guests"
          value={filter.minGuests}
          read={readAmount}
          show={n0}
          onChange={(minGuests) => update({ minGuests })}
        />
        <FilterCheck
          label="Hide ruled out"
          checked={filter.hideRuledOut}
          onChange={(hideRuledOut) => update({ hideRuledOut })}
        />
        <ShowEverything filtering={filtering} onClear={() => setFilter(NO_VENUE_FILTER)} />
      </Toolbar>
      <CountLine>{countWords(rows.length, visible, filtering, "venue")}</CountLine>
      <ul>
        {rows.slice(0, visible).map((venue) => (
          <li key={venue.name}>
            {venue.name}, {venue.location}
          </li>
        ))}
      </ul>
      <ShowMore more={more} onMore={() => setShown((count) => count + PAGE)} />
    </>
  );
}

function ItemsDemo() {
  const [order, setOrder] = useState<OrderState<ItemOrderKey>>({ key: "own", direction: "asc" });
  const sorted = order.key !== "own";
  const rows = orderItems(ITEMS, order.key, order.direction);
  const label = ITEM_ORDERS.find((choice) => choice.key === order.key)?.label ?? "";

  return (
    <>
      <h3>Our order, or sorted for now</h3>
      <Toggles>
        <OrderBy choices={ITEM_ORDERS} order={order} onChange={setOrder} directional={sorted} />
      </Toggles>
      {sorted ? (
        <SortedNote label={label} onBack={() => setOrder({ key: "own", direction: "asc" })} />
      ) : null}
      <ul>
        {rows.map((item) => (
          <li key={item.item}>
            {item.item}, {item.vendor || "no vendor yet"}
          </li>
        ))}
      </ul>
    </>
  );
}

function CountWords() {
  return (
    <>
      <h3>Count line words</h3>
      <ul>
        <li>{totalText(12, "vendor")}</li>
        <li>{pagedText(1206, 100, "booking")}</li>
        <li>{hereText(12, "vendor")}</li>
        <li>{matchText(3, "booking")}</li>
        <li>{matchText(1, "booking")}</li>
        <li>{ofText(12, 2004)}</li>
        <li>{showingOfText(60, 1507)}</li>
      </ul>
    </>
  );
}

/**
 * Task 3.7's section of the component gallery: the search, the selects, the
 * range and check filters, the count line, the sorted note and the paging
 * button, over fixed fake data run through the model's order and filter
 * functions. The gallery's e2e test drives it.
 */
export function ToolsDemos() {
  return (
    <>
      <VendorsDemo />
      <VenuesDemo />
      <ItemsDemo />
      <CountWords />
    </>
  );
}
