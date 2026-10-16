import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Booking, Part } from "@/lib/model/bookings";
import { dues, type Funder, type WhatIfRecord } from "@/lib/model/money";
import { BookingEntry } from "@/veil/parts/rows/booking-entry";
import { DocumentRow, type DocumentRowData } from "@/veil/parts/rows/document-row";
import { DueRow } from "@/veil/parts/rows/due-row";
import { FileRow, FolderRow, type FileRowData } from "@/veil/parts/rows/file-row";
import { Ledger } from "@/veil/parts/rows/ledger";
import { VendorRow, type VendorRowData } from "@/veil/parts/rows/vendor-row";
import { WhatIfEntry } from "@/veil/parts/rows/what-if-entry";
import { NO_TEXT } from "@/veil/parts/rows/ledger-text";
import { FlashProvider } from "@/veil/shell/flash";

// Task 3.5: the ledger rows as markup (guide §4.7). The flash and the search
// marks are checked in a browser by tests/e2e/demo/veil-ledger.spec.ts.

const TODAY = "2026-10-14";
const NOW = Date.parse("2026-10-14T11:30:00+07:00");
const MINUTE = 60_000;

const FUNDERS: Funder[] = [
  { id: "greg", name: "Greg" },
  { id: "bella-fam", name: "Bella’s family" },
  { id: "ck", name: "CK" },
];

const markup = (node: ReactElement) =>
  renderToStaticMarkup(
    <FlashProvider>
      <Ledger label="Rows">{node}</Ledger>
    </FlashProvider>,
  );

const part = (over: Partial<Part> & Pick<Part, "id" | "name">): Part => ({ price: 0, paid: 0, funder: null, due: null, step: "", ...over });

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
  bookedOn: null,
  from: null,
  direct: false,
  ...over,
});

const pelaminan = booking({
  id: "vendor-v1",
  name: "Pelaminan Ayu",
  category: "Decoration",
  estimate: 22_000_000,
  parts: [
    part({ id: "p1", name: "Deposit", price: 5_000_000, paid: 5_000_000, funder: "greg" }),
    part({ id: "p2", name: "Final payment", price: 20_000_000, funder: "bella-fam", due: "2026-10-30", step: "Pay the balance" }),
  ],
});

const buttonClass = (html: string, label: string) =>
  new RegExp(`<button[^>]*class="([^"]*)"[^>]*>${label}</button>`).exec(html)?.[1] ?? "";

describe("booking entries", () => {
  it("links the whole entry to its booking, with the name, price, meta and status", () => {
    const html = markup(<BookingEntry booking={pelaminan} funders={FUNDERS} today={TODAY} />);
    expect(html).toMatch(/<a[^>]*href="\/new\/budget\/bookings\/vendor-v1"[^>]*>/);
    expect(html).toContain("Pelaminan Ayu");
    expect(html).toContain("Rp 25.000.000");
    expect(html).toContain("Decoration, paid by Greg and Bella’s family, Rp 3.000.000 over the estimate");
    expect(html).toContain("Rp 20.000.000 to pay");
    expect(html).toContain("Deposit");
    expect(html).toContain("Final payment");
  });

  it("writes the late status in rose and the paid one in sage", () => {
    const late = booking({ id: "vendor-v3", name: "Dimas", price: 15_000_000, paid: 5_000_000, funder: "ck", due: "2026-10-10" });
    expect(markup(<BookingEntry booking={late} funders={FUNDERS} today={TODAY} />)).toMatch(/class="[^"]*statusLate[^"]*">Rp 10.000.000 late</);
    const paid = booking({ id: "vendor-v2", name: "Catering", price: 55_500_000, paid: 55_500_000, funder: "ck" });
    expect(markup(<BookingEntry booking={paid} funders={FUNDERS} today={TODAY} />)).toMatch(/class="[^"]*statusDone[^"]*">Paid in full</);
  });

  it("collapses past five parts to the first four owing and counts the rest", () => {
    const many = booking({
      id: "vendor-v6",
      name: "Make-up",
      parts: Array.from({ length: 7 }, (_, i) => part({ id: `m${i}`, name: `Part ${i}`, price: 1_000_000, paid: i === 2 ? 1_000_000 : 0 })),
    });
    const html = markup(<BookingEntry booking={many} funders={FUNDERS} today={TODAY} />);
    expect(html).toContain("and 3 more parts");
    expect(html).not.toContain("Part 6");
  });
});

describe("what-if entries", () => {
  const item: WhatIfRecord & { category?: string | null } = {
    id: "w2",
    name: "Grand hall upgrade",
    category: "Venue",
    totalPrice: 0,
    funder: null,
    subEntries: [
      { id: "s1", name: "Sound system", totalPrice: 4_000_000, funder: "greg" },
      { id: "s2", name: "Lighting", totalPrice: 6_000_000 },
    ],
  };

  it("draws the price in italics with its parts on dashed leaders", () => {
    const html = markup(<WhatIfEntry item={item} funders={FUNDERS} />);
    expect(html).toMatch(/class="[^"]*whatIf[^"]*"/);
    expect(html).toContain("Rp 10.000.000");
    expect(html).toMatch(/class="[^"]*hypothetical/);
    expect(html).toContain("Rp 4.000.000, Greg");
    expect(html).toContain("Rp 6.000.000, no funder yet");
  });

  it("offers Edit and Remove only when their handlers are passed", () => {
    expect(markup(<WhatIfEntry item={item} funders={FUNDERS} />)).not.toContain("Edit");
    const html = markup(<WhatIfEntry item={item} funders={FUNDERS} onEdit={() => {}} onRemove={() => {}} />);
    expect(html).toContain(">Edit</button>");
    expect(html).toMatch(/class="[^"]*rose[^"]*">Remove</);
  });
});

describe("vendor rows", () => {
  const vendor: VendorRowData = {
    id: "v1",
    name: "Pelaminan Ayu",
    category: "Decoration",
    contact: "Bu Ayu",
    price: 25_000_000,
    optionCount: 3,
    rating: 4.8,
    reviewers: 120,
  };

  it("shows the preferred price, the rating, the shortlist link and the price options", () => {
    const html = markup(<VendorRow vendor={vendor} href="/new/vendors/v1" shortlistHref="/new/shortlist/v1" />);
    expect(html).toMatch(/<a[^>]*href="\/new\/vendors\/v1"[^>]*>Pelaminan Ayu<\/a>/);
    expect(html).toContain("Rp 25.000.000");
    expect(html).toMatch(/<b class="[^"]*score[^"]*">4,8<\/b> from 120 reviews/);
    expect(html).toContain("Bu Ayu");
    expect(html).toContain("On the shortlist");
    expect(html).toContain("3 price options");
  });

  it("keeps the choice and says so under a row whose change didn't save, with Try again", () => {
    const html = markup(
      <VendorRow
        vendor={vendor}
        href="/new/vendors/v1"
        failed={{ message: "Couldn’t save the change to Pelaminan Ayu. Your choice is kept.", onRetry: () => {} }}
      />,
    );
    expect(html).toMatch(/role="alert"[^>]*><span>Couldn’t save the change to Pelaminan Ayu\. Your choice is kept\.<\/span>/);
    expect(html).toContain("Try again");
    expect(markup(<VendorRow vendor={vendor} href="/new/vendors/v1" />)).not.toContain("Try again");
  });

  it("says No price yet and No rating yet, and keeps the meta's height when empty", () => {
    const empty: VendorRowData = { id: "v2", name: "Studio Dimas", category: "Photography", contact: null, price: null, optionCount: 0, rating: null, reviewers: 0 };
    const html = markup(<VendorRow vendor={empty} href="/new/vendors/v2" />);
    expect(html).toContain("No price yet");
    expect(html).toContain("No rating yet");
    expect(html).toContain(NO_TEXT);
    expect(html).not.toContain("On the shortlist");
  });

  it("greys a ruled-out vendor's name and leaves the keen heart and stage slots for Task 3.9", () => {
    const ruled: VendorRowData = { ...vendor, id: "v4", name: "Organ and Co", ruledOut: true };
    const html = markup(<VendorRow vendor={ruled} href="/new/vendors/v4" keen={<i>KEEN</i>} stage={<i>STAGE</i>} />);
    expect(html).toMatch(/<li class="[^"]*ruled/);
    expect(html).toMatch(/class="[^"]*vname[^"]*"[^>]*>Organ and Co/);
    expect(html).toContain("KEEN");
    expect(html).toContain("STAGE");
  });
});

describe("payments due", () => {
  const dueOf = (id: string) => dues([pelaminan], TODAY).find((d) => d.part.id === id);
  const late = booking({ id: "vendor-v3", name: "Dimas Studio", price: 15_000_000, paid: 5_000_000, funder: "ck", due: "2026-10-10", step: "Second payment" });
  const lateDue = dues([late], TODAY)[0];

  it("draws a late due in rose, its date card hidden from screen readers and Record payment filled", () => {
    const html = markup(<DueRow due={lateDue} funders={FUNDERS} today={TODAY} />);
    expect(html).toMatch(/<li class="[^"]*dueLate/);
    expect(html).toMatch(/<span class="[^"]*dateCard[^"]*" aria-hidden="true">/);
    expect(html).toMatch(/class="[^"]*lateWhen[^"]*">4 days late</);
    expect(html).toContain(", paid by CK. Second payment");
    expect(html).toContain("Rp 10.000.000");
    expect(buttonClass(html, "Record payment")).not.toMatch(/quiet/);
  });

  it("reads the long date for a due further off, with a quiet Record payment", () => {
    const html = markup(<DueRow due={dueOf("p2")!} funders={FUNDERS} today={TODAY} />);
    expect(html).toContain("Pelaminan Ayu, final payment");
    expect(html).toContain("Friday 30 October, paid by Bella’s family. Pay the balance");
    expect(html).not.toMatch(/lateWhen/);
    expect(buttonClass(html, "Record payment")).toMatch(/quiet/);
  });
});

describe("documents", () => {
  const doc: DocumentRowData = {
    id: "d3",
    title: "Photographer contract",
    text: "The photographer arrives two hours before the ceremony. The deposit is Rp 5.000.000.",
    editedAt: NOW - 12 * MINUTE,
    editedBy: "Bella",
  };

  it("marks the search matches in the title and in the words under it", () => {
    const html = markup(<DocumentRow doc={doc} href="/new/documents/d3" now={NOW} query="contract" />);
    expect(html).toMatch(/<mark class="[^"]*mark[^"]*">contract<\/mark>/);
    expect(html).not.toMatch(/<mark[^>]*>photographer<\/mark>/i);
  });

  it("writes when it was edited and by whom, and says Untitled and Empty when there is no title or no words", () => {
    expect(markup(<DocumentRow doc={doc} href="/x" now={NOW} />)).toContain("12 min ago by Bella");
    const blank: DocumentRowData = { id: "d4", title: "", text: "", editedAt: null, editedBy: null };
    const html = markup(<DocumentRow doc={blank} href="/x" now={NOW} />);
    expect(html).toMatch(/class="[^"]*untitled[^"]*">Untitled</);
    expect(html).toContain("Empty");
  });
});

describe("files and folders", () => {
  const contract: FileRowData = { id: "f1", name: "Pelaminan contract.pdf", size: 2_400_000, date: "2026-10-02", category: "Contract", description: "Signed copy" };

  it("shows the file's type, hidden from screen readers, when there is no picture", () => {
    const html = markup(<FileRow file={contract} today={TODAY} />);
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*>pdf<\/span>/);
    expect(html).toMatch(/class="[^"]*cat[^"]*">Contract</);
    expect(html).toContain(", Signed copy");
    expect(html).toContain("2,3 MB");
    expect(html).toContain("2 Oct");
  });

  it("shows the picture when the file has a thumbnail", () => {
    const html = markup(<FileRow file={{ ...contract, id: "f2", name: "Moodboard.jpg", thumb: "/icon-192.png" }} today={TODAY} />);
    expect(html).toMatch(/<img[^>]*src="\/icon-192.png"[^>]*alt=""/);
  });

  it("names the folder in a search, and keeps the height of an empty meta line", () => {
    const found: FileRowData = { ...contract, id: "f5", category: null, path: ["Vendors", "Pelaminan Ayu"] };
    expect(markup(<FileRow file={found} today={TODAY} withPath />)).toContain("in Vendors › Pelaminan Ayu");
    const bare: FileRowData = { id: "f3", name: "Floor plan.xlsx", size: 150_000, date: "2026-10-14" };
    const html = markup(<FileRow file={bare} today={TODAY} />);
    expect(html).toContain(NO_TEXT);
    expect(html).toContain("146 KB");
  });

  it("draws a folder as a link with its counts, and says Empty for an empty one", () => {
    const html = markup(<FolderRow folder={{ id: "fo1", name: "Vendors", folders: 6, files: 12 }} href="/new/files/fo1" />);
    expect(html).toMatch(/<a[^>]*href="\/new\/files\/fo1"[^>]*>/);
    expect(html).toContain("6 folders, 12 files");
    expect(html.match(/<svg/g)).toHaveLength(2);
    expect(markup(<FolderRow folder={{ id: "fo3", name: "Empty", folders: 0, files: 0 }} href="/x" />)).toContain("Empty");
  });
});
