import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Booking } from "@/lib/model/bookings";
import { dues, type Due, type Funder } from "@/lib/model/money";
import { Doors, type DoorItem } from "@/veil/parts/doors/doors";
import { AfterLine, NextCard } from "@/veil/parts/next-card/next-card";
import { FlashProvider } from "@/veil/shell/flash";

// Task 3.2: the next card, its after line and the doors as markup (guide §3,
// §4.5, §4.6). The e2e test in tests/e2e/demo/veil-next.spec.ts checks the look.

// The card reads the flash state, so it draws inside the provider the app gives it.
const markup = (node: ReactElement) => renderToStaticMarkup(<FlashProvider>{node}</FlashProvider>);
const TODAY = "2026-10-14";

/** The class names of the element whose text is `text`. CSS-module hashes stay in, so match on a part of a name. */
function classesOf(html: string, text: string) {
  const match = html.match(new RegExp(`<[a-z]+ class="([^"]*)">${text}<`));
  return match?.[1].split(" ") ?? [];
}

const FUNDERS: Funder[] = [
  { id: "ck", name: "CK" },
  { id: "greg", name: "Gregory" },
];

function booking(id: string, name: string, due: string, price: number, extra: Partial<Booking> = {}): Booking {
  return {
    id,
    kind: "vendor",
    recordId: id,
    name,
    category: "Catering",
    price,
    paid: 0,
    funder: "ck",
    due,
    step: "",
    parts: [],
    estimate: null,
    bookedOn: null,
    from: "vendor",
    direct: false,
    ...extra,
  };
}

/** The dues the model gives, earliest first, as the screen passes them to the card. */
function duesOf(...bookings: Booking[]): Due[] {
  return dues(bookings, TODAY);
}

describe("NextCard", () => {
  const late = duesOf(
    booking("vendor-catering", "Dapur Lestari Catering", "2026-10-09", 55_500_000),
    booking("vendor-florist", "Kirana Florist", "2026-10-11", 18_000_000, { funder: "greg" }),
    booking("vendor-chairs", "Sewa Kursi Mekar", "2026-10-12", 12_000_000),
  );

  it("is a labelled section with the label, flag, name, amount, meta and Record payment", () => {
    const html = markup(
      <NextCard today={TODAY} next={late[0]!} lateCount={3} funders={FUNDERS} onRecord={() => {}} />,
    );
    expect(html).toMatch(/^<section class="[^"]*" aria-label="Next payment">/);
    expect(html).toContain("Next to pay, 1 of 3 late");
    expect(html).toMatch(/class="[^"]*flag[^"]*">5 days late<\/span>/);
    expect(html).toMatch(/class="[^"]*amt[^"]*">Rp 55\.500\.000<\/span>/);
    expect(html).toContain("Catering, paid by CK, was due Friday 9 October");
    expect(html).toMatch(/<button type="button" class="[^"]*">Record payment<\/button>/);
  });

  it("links the name to the booking's page in the new UI", () => {
    const html = markup(
      <NextCard today={TODAY} next={late[0]!} lateCount={3} funders={FUNDERS} onRecord={() => {}} />,
    );
    expect(html).toMatch(
      /<h2 class="[^"]*"><a class="[^"]*" href="\/budget\/bookings\/vendor-catering">Dapur Lestari Catering<\/a><\/h2>/,
    );
  });

  it("colours the flag by urgency: rose when late, gold within 14 days, calm after", () => {
    const soon = duesOf(booking("vendor-band", "Sahabat Musik", "2026-10-18", 12_000_000));
    const later = duesOf(booking("vendor-venue", "Taman Cempaka", "2026-12-02", 30_000_000));
    const render = (next: Due) =>
      markup(<NextCard today={TODAY} next={next} lateCount={0} funders={FUNDERS} onRecord={() => {}} />);

    const late5 = classesOf(render(late[0]!), "5 days late");
    expect(late5.some((name) => name.includes("flag"))).toBe(true);
    expect(late5.some((name) => /gold|calm/.test(name))).toBe(false);

    const gold = classesOf(render(soon[0]!), "due in 4 days");
    expect(gold.some((name) => name.includes("flag"))).toBe(true);
    expect(gold.some((name) => name.includes("gold"))).toBe(true);

    const calm = classesOf(render(later[0]!), "2 Dec");
    expect(calm.some((name) => name.includes("flag"))).toBe(true);
    expect(calm.some((name) => name.includes("calm"))).toBe(true);
  });

  it("shows the empty card with its words and no amount or button when nothing is due", () => {
    const html = markup(
      <NextCard today={TODAY} next={null} lateCount={0} funders={FUNDERS} onRecord={() => {}} />,
    );
    expect(html).toContain("Nothing due right now");
    expect(html).toContain("Every booking with a due date is paid up.");
    expect(html).not.toContain("Record payment");
    expect(html).not.toMatch(/Rp /);
  });
});

describe("AfterLine", () => {
  it("names the amount, the booking and the day of the payment after the next", () => {
    const second = duesOf(
      booking("vendor-catering", "Dapur Lestari Catering", "2026-10-09", 55_500_000),
      booking("vendor-florist", "Kirana Florist", "2026-10-11", 18_000_000),
    )[1]!;
    expect(markup(<AfterLine due={second} today={TODAY} />)).toMatch(
      /^<p class="[^"]*">After that, <b>Rp 18\.000\.000<\/b> to Kirana Florist on Sunday 11 October\.<\/p>$/,
    );
  });
});

describe("Doors", () => {
  const doors: DoorItem[] = [
    {
      id: "payments",
      name: "Payments due",
      href: "/budget/payments",
      summary: [{ text: "1 late", attention: true }, { text: ", 6 payments until March" }],
    },
    {
      id: "who-pays",
      name: "Who pays",
      href: "/budget/who-pays",
      summary: [{ text: "CK and Gregory" }],
    },
  ];

  it("is a list with one item for each door", () => {
    const html = markup(<Doors doors={doors} />);
    expect(html).toMatch(/^<ul class="[^"]*">/);
    expect(html.match(/<li>/g)).toHaveLength(2);
  });

  it("makes each door a link to its address, with the name and the summary inside", () => {
    const html = markup(<Doors doors={doors} />);
    expect(html).toMatch(
      /<a class="[^"]*" href="\/budget\/payments"><span class="[^"]*">Payments due<\/span><span class="[^"]*"><span class="[^"]*">1 late<\/span>, 6 payments until March<\/span>/,
    );
  });

  it("draws the one attention piece rose, and the rest plain", () => {
    const html = markup(<Doors doors={doors} />);
    expect(html.match(/class="[^"]*late[^"]*"/g)).toHaveLength(1);
    expect(html).toContain("CK and Gregory");
  });

  it("hides the chevron from screen readers, since the link's name already has the words", () => {
    expect(markup(<Doors doors={doors} />)).toMatch(/<svg [^>]*aria-hidden="true"/);
  });

  it("takes a class for the spacing above it", () => {
    expect(markup(<Doors doors={doors} className="extra" />)).toMatch(/^<ul class="[^"]*extra[^"]*">/);
  });
});
