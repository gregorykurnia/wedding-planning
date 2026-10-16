import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readAmount } from "@/lib/model/amount";
import { n0, rp } from "@/lib/model/format";
import { VENDOR_ORDERS } from "@/lib/model/order";
import { FilterCheck, RangeField, ShowEverything } from "@/veil/parts/tools/filters";
import { CountLine, ShowMore, SortedNote } from "@/veil/parts/tools/results";
import { SearchField } from "@/veil/parts/tools/search-field";
import { FilterSelect, OrderBy } from "@/veil/parts/tools/selects";
import { FilterBar, Toggles, Toolbar } from "@/veil/parts/tools/toolbar";

// Task 3.7: the search, ordering, filter, count and paging components as
// markup (guide §4.12, §6.8). The focus and the way a value commits are driven
// in a browser by tests/e2e/demo/veil-tools.spec.ts.

const markup = (node: ReactElement) => renderToStaticMarkup(node);
const noop = () => {};

describe("SearchField", () => {
  it("is an input of type search, inside a label whose hidden text says what's searched", () => {
    const search = markup(
      <SearchField label="Search vendors" placeholder="Search names, contacts and notes" value="ca" onChange={noop} />,
    );
    expect(search).toMatch(/^<label [^>]*>/);
    expect(search).toContain('<span class="sr">Search vendors</span>');
    expect(search).toMatch(/<input (?=[^>]*type="search")(?=[^>]*placeholder="Search names, contacts and notes")(?=[^>]*value="ca")/);
  });

  it("keeps the magnifier out of what a screen reader hears", () => {
    expect(markup(<SearchField label="Search" placeholder="" value="" onChange={noop} />)).toMatch(
      /<svg [^>]*aria-hidden="true"/,
    );
  });
});

describe("FilterSelect and OrderBy", () => {
  it("ties the visible label to the select, and lists every option", () => {
    const select = markup(
      <FilterSelect
        label="Stage"
        value="Booked"
        options={[
          { value: "", label: "Any" },
          { value: "Booked", label: "Booked" },
        ]}
        onChange={noop}
      />,
    );
    const id = select.match(/<label for="([^"]+)">Stage<\/label>/)?.[1];
    expect(id).toBeTruthy();
    expect(select).toContain(`<select id="${id}"`);
    expect(select).toMatch(/<option(?=[^>]*value="Booked")(?=[^>]*selected="")[^>]*>Booked<\/option>/);
    expect(select).toContain('<option value="">Any</option>');
  });

  it("shows the order's label and the direction word", () => {
    const order = markup(
      <OrderBy choices={VENDOR_ORDERS} order={{ key: "rating", direction: "desc" }} onChange={noop} />,
    );
    expect(order).toContain(">Order by<");
    expect(order).toMatch(/<option(?=[^>]*value="rating")(?=[^>]*selected="")[^>]*>Rating<\/option>/);
    expect(order).toContain(">Descending<");
  });

  it("shows no direction word for our own order, which has none", () => {
    const order = markup(
      <OrderBy directional={false} choices={VENDOR_ORDERS} order={{ key: "name", direction: "asc" }} onChange={noop} />,
    );
    expect(order).not.toContain("Ascending");
    expect(order).not.toContain("Descending");
  });
});

describe("RangeField", () => {
  it("writes the number back in the model's form, with the words either side", () => {
    const range = markup(
      <RangeField
        label="Costs at most"
        value={45000000}
        read={readAmount}
        show={rp}
        onChange={noop}
      />,
    );
    expect(range).toContain("Costs at most");
    expect(range).toMatch(/<input (?=[^>]*placeholder="Any")(?=[^>]*value="Rp 45\.000\.000")/);
  });

  it("is empty when nothing limits it, and says guests after a count", () => {
    const range = markup(
      <RangeField label="Holds at least" unit="guests" value={null} read={readAmount} show={n0} onChange={noop} />,
    );
    expect(range).toMatch(/<input (?=[^>]*value="")/);
    expect(range).toMatch(/\/>guests<\/label>$/);
  });
});

describe("FilterCheck", () => {
  it("is a checkbox with its words after it", () => {
    const check = markup(<FilterCheck label="Hide ruled out" checked onChange={noop} />);
    expect(check).toMatch(/<input (?=[^>]*type="checkbox")(?=[^>]*checked="")/);
    expect(check).toContain("Hide ruled out</label>");
  });
});

describe("ShowEverything", () => {
  it("is absent while nothing is filtered", () => {
    expect(markup(<ShowEverything filtering={false} onClear={noop} />)).toBe("");
  });

  it("offers the way back to everything while a filter is on", () => {
    expect(markup(<ShowEverything filtering onClear={noop} />)).toContain(">Show everything<");
    expect(markup(<ShowEverything filtering label="Show everyone" onClear={noop} />)).toContain(">Show everyone<");
  });
});

describe("CountLine", () => {
  it("carries its words in a polite live region", () => {
    const count = markup(<CountLine>1.206 bookings, showing 100</CountLine>);
    expect(count).toMatch(/^<p [^>]*aria-live="polite"[^>]*>1\.206 bookings, showing 100<\/p>$/);
  });
});

describe("SortedNote", () => {
  it("says the list is sorted for now, and offers to put our order back", () => {
    const note = markup(<SortedNote label="Vendor" onBack={noop} />);
    expect(note).toContain("Sorted by vendor for now. Your own order is kept.");
    expect(note).toMatch(/<button [^>]*type="button"[^>]*>Back to our order<\/button>/);
  });
});

describe("ShowMore", () => {
  it("is absent when nothing more is left", () => {
    expect(markup(<ShowMore more={0} onMore={noop} />)).toBe("");
  });

  it("says how many more it shows, as a quiet button", () => {
    const more = markup(<ShowMore more={100} onMore={noop} />);
    expect(more).toContain(">Show 100 more<");
    expect(more).toMatch(/<button [^>]*type="button"/);
  });
});

describe("the toolbar wrappers", () => {
  it("hold their children in the order given", () => {
    const bar = markup(
      <Toolbar continued>
        <Toggles>
          <span>first</span>
        </Toggles>
        <FilterBar>
          <span>second</span>
        </FilterBar>
      </Toolbar>,
    );
    expect(bar.indexOf("first")).toBeLessThan(bar.indexOf("second"));
  });
});
