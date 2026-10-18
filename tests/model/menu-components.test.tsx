import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Part } from "@/lib/model/bookings";
import { CarryLines } from "@/veil/parts/menu-card/carry-lines";
import { MenuCardList } from "@/veil/parts/menu-card/menu-card-list";
import { partLineList } from "@/veil/parts/menu-card/menu-text";
import { PackageLines } from "@/veil/parts/menu-card/package-lines";
import packageStyles from "@/veil/parts/menu-card/package-lines.module.css";
import { PartDisclosure } from "@/veil/parts/menu-card/part-disclosure";
import { PartLines } from "@/veil/parts/menu-card/part-lines";
import partLinesStyles from "@/veil/parts/menu-card/part-lines.module.css";
import { Tally } from "@/veil/parts/menu-card/tally";
import tallyStyles from "@/veil/parts/menu-card/tally.module.css";

// Task 3.6: parts, menu cards, packages, the tally and the carry lines as markup
// (guide §4.8). The gallery e2e test in tests/e2e/demo/veil-parts.spec.ts checks
// them in a browser.

const TODAY = "2026-10-14";
const markup = (node: ReactElement) => renderToStaticMarkup(node);
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;

const part = (over: Partial<Part> & Pick<Part, "id" | "name">): Part => ({
  price: 25_000_000,
  paid: 0,
  funder: null,
  due: null,
  step: "",
  ...over,
});

describe("MenuCardList: a second muted line and written notes", () => {
  it("draws the meta line and the notes under what's included, with the notes' addresses as links", () => {
    const html = markup(
      <MenuCardList
        options={[
          {
            id: "k1",
            name: "Gold",
            price: 62_500_000,
            includes: "Arch and aisle flowers",
            meta: "120 reviews. Next: Send the quote",
            notes: "Ask about the arch https://example.com/arch",
          },
        ]}
      />,
    );
    expect(html).toContain("Arch and aisle flowers");
    expect(html).toContain("120 reviews. Next: Send the quote");
    expect(html).toContain('href="https://example.com/arch"');
    expect(html).toContain("example.com/arch");
  });

  it("draws neither line when there is nothing to say", () => {
    const html = markup(<MenuCardList options={[{ id: "k1", name: "Gold", price: 1, meta: "", notes: "" }]} />);
    expect(count(html, /<p[ >]/g)).toBe(0);
  });
});

describe("PartLines", () => {
  it("draws each line as a name, a decorative leader and a value", () => {
    const html = markup(
      <PartLines {...partLineList([part({ id: "b", name: "Balance", due: "2026-10-10" })], TODAY)} />,
    );
    expect(html).toMatch(/^<ul [^>]*><li[^>]*><span [^>]*>Balance<\/span><span [^>]*aria-hidden="true"[^>]*><\/span>/);
    expect(html).toContain("Rp 25.000.000, was due 10 Oct");
    expect(count(html, /aria-hidden="true"/g)).toBe(1);
  });

  it("says how many parts are left out of a collapsed list", () => {
    // Part 0 is paid; the first four of the six still owing are shown, so three are left out.
    const parts = Array.from({ length: 7 }, (_, i) => part({ id: `p${i}`, name: `Part ${i}`, paid: i === 0 ? 25_000_000 : 0 }));
    const html = markup(<PartLines {...partLineList(parts, TODAY)} />);
    expect(html).toContain("and 3 more parts");
    expect(count(html, /<li[ >]/g)).toBe(5);
  });

  it("draws a what-if list with dashed leaders and italic values", () => {
    const html = markup(
      <PartLines hypothetical lines={[{ key: "photo", name: "Photo booth", value: "Rp 8.000.000, Bella", tone: "plain" }]} more={0} />,
    );
    expect(html).toContain(partLinesStyles.hypothetical);
    expect(html).not.toContain("and ");
  });
});

describe("PartDisclosure", () => {
  it("is a closed disclosure whose summary has the name, price, funder and status", () => {
    const html = markup(
      <ul>
        <PartDisclosure
          part={part({ id: "b", name: "Balance", due: "2026-10-10", funder: "gregory" })}
          today={TODAY}
          funder="Gregory"
        >
          <p>The fields</p>
        </PartDisclosure>
      </ul>,
    );
    expect(html).toMatch(/^<ul><li [^>]*><details [^>]*>/);
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(html).toContain("Balance");
    expect(html).toContain("Rp 25.000.000");
    expect(html).toContain("Gregory");
    expect(html).toContain("Rp 25.000.000 4 days late");
    expect(html).toContain("<p>The fields</p>");
  });

  it("opens when the screen says it should", () => {
    const html = markup(<PartDisclosure part={part({ id: "b", name: "Balance" })} today={TODAY} funder="CK" defaultOpen />);
    expect(html).toMatch(/<details [^>]*open=""/);
  });
});

describe("MenuCardList", () => {
  it("gives the preferred option the gold line instead of an offer to lean towards it", () => {
    const html = markup(
      <MenuCardList
        options={[
          { id: "gold", name: "Gold package", price: 62_500_000, preferred: true },
          { id: "silver", name: "Silver package", price: 45_000_000 },
        ]}
        onLean={() => {}}
        onEdit={() => {}}
      />,
    );
    expect(html).toContain("The one we’re leaning towards");
    expect(count(html, /Lean towards this one/g)).toBe(1);
    expect(html).toContain("Rp 62.500.000");
  });

  it("shows an action only when its handler is passed", () => {
    expect(markup(<MenuCardList options={[{ id: "s", name: "Stationery" }]} />)).not.toMatch(/Edit|Remove|Lean/);
    const onlyRemove = markup(<MenuCardList options={[{ id: "s", name: "Stationery" }]} onRemove={() => {}} />);
    expect(onlyRemove).toContain("Remove");
    expect(onlyRemove).not.toContain("Edit");
  });

  it("draws a category with no price and no leader", () => {
    const html = markup(<MenuCardList options={[{ id: "s", name: "Stationery" }]} onEdit={() => {}} />);
    expect(html).not.toContain("Rp");
    expect(html).not.toContain("aria-hidden");
  });

  it("puts a note where a category's price would be, after the leader", () => {
    const html = markup(<MenuCardList options={[{ id: "f", name: "Florist", note: "Ours, 3 vendors" }]} />);
    expect(html).toContain("Ours, 3 vendors");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("Rp");
  });

  it("draws an option's own actions instead of the list's", () => {
    const html = markup(
      <MenuCardList
        options={[
          { id: "f", name: "Florist", actions: <button>Rename</button> },
          { id: "o", name: "Other" },
        ]}
        onEdit={() => {}}
      />,
    );
    expect(html).toContain("Rename");
    // The list-wide Edit shows only on the option with no actions of its own.
    expect(count(html, />Edit</g)).toBe(1);
  });

  it("lets an option's card be replaced while it is open for a rename", () => {
    const html = markup(
      <MenuCardList options={[{ id: "f", name: "Florist", note: "Ours", replace: <input aria-label="Rename Florist" /> }]} />,
    );
    expect(html).toContain('aria-label="Rename Florist"');
    expect(html).not.toContain("Ours");
  });

  it("prints what's included under the name", () => {
    const html = markup(
      <MenuCardList options={[{ id: "s", name: "Silver", price: 1, includes: "Up to 150 guests" }]} />,
    );
    expect(html).toContain("Up to 150 guests");
  });
});

describe("Tally", () => {
  it("counts with dots and marks the sub-line and the count kept apart", () => {
    const html = markup(
      <Tally
        rows={[
          { label: "Both events", count: 1234 },
          { label: "of which, if space allows", count: 21, tone: "of-which" },
          { label: "Unsure, living abroad", count: 7, tone: "apart" },
        ]}
      />,
    );
    expect(html).toContain("1.234");
    expect(html).toContain(tallyStyles.ofWhich);
    expect(html).toContain(tallyStyles.apart);
    expect(count(html, /aria-hidden="true"/g)).toBe(3);
  });
});

describe("CarryLines", () => {
  it("shows each funder's extra with a plus sign, and says how many more there are", () => {
    const html = markup(
      <CarryLines
        rows={[
          { key: "ck", label: "CK", amount: 12_000_000 },
          { key: "none", label: "Not assigned yet", amount: 3_000_000 },
        ]}
        more={1}
      />,
    );
    expect(html).toContain("+ Rp 12.000.000");
    expect(html).toContain("Not assigned yet");
    expect(html).toContain("and 1 more funder");
  });
});

describe("PackageLines", () => {
  it("marks the package we're leaning towards", () => {
    const html = markup(
      <PackageLines
        packages={[
          { id: "half", name: "Half day", price: 18_000_000 },
          { id: "full", name: "Full day", price: 26_500_000, preferred: true },
        ]}
      />,
    );
    expect(html).toContain("Rp 26.500.000");
    expect(count(html, new RegExp(packageStyles.preferred, "g"))).toBe(1);
  });

  it("closes with the line for the packages it doesn't list", () => {
    const one = [{ id: "a", name: "Half day", price: 18_000_000 }];
    expect(markup(<PackageLines packages={one} more="and 26 more packages" />)).toContain("and 26 more packages");
    expect(markup(<PackageLines packages={one} more={null} />)).not.toContain("more package");
  });
});
