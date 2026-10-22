import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { vendorFromDoc } from "@/lib/data/adapters/bookings";
import type { BookingPage } from "@/lib/data/use-booking";
import { REMOVE_BOOKING } from "@/lib/model/booking-detail";
import { bookingFromVendor } from "@/lib/model/bookings";

// Phase 8 review S5 (P7-S15's wiring): while a booking's files haven't arrived, its screen gives the
// Files heading no count and the remove question says "with its files" uncounted. The screen renders as on
// a server; the text links are stood in for so the remove link's handler can be called, and the confirm
// question is caught as it is asked.

let page: BookingPage;
let asked: { body?: string }[] = [];
let links: { label: string; onClick?: () => void }[] = [];

vi.mock("@/lib/data/use-booking", () => ({ useBooking: () => ({ status: "offline", data: page }) }));
vi.mock("@/lib/data/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/session")>()),
  useSession: () => ({ connection: "offline" }),
  useOnline: () => false,
}));
vi.mock("@/lib/data/partner", () => ({ useRemovedByPartner: () => null }));
vi.mock("@/lib/data/uploads", () => ({ useUploadQueue: () => null }));
vi.mock("@/veil/parts/files/file-tiles", () => ({ FileTiles: () => null }));
vi.mock("@/veil/shell/confirm", () => ({
  useConfirm: () => async (q: { body?: string }) => {
    asked.push(q);
    return false;
  },
}));
vi.mock("@/veil/shell/toasts", () => ({ useToast: () => ({ undoable: () => {}, confirmation: () => {}, failure: () => {} }) }));
vi.mock("@/veil/parts/files/file-details-sheet", () => ({ useOpenFile: () => () => {} }));
vi.mock("@/veil/parts/payment/use-record-payment", () => ({ useRecordPayment: () => () => {} }));
vi.mock("@/veil/parts/actions/text-link", () => ({
  TextLink: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => {
    links.push({ label: String(children), onClick });
    return <button type="button">{children}</button>;
  },
}));

const { BookingScreen } = await import("@/veil/screens/booking/booking-screen");

const vendor = vendorFromDoc("kebun", {
  name: "Kebun Bunga Atelier",
  category: "Decoration",
  contractStatus: "Chosen",
  totalPrice: 12_000_000,
});
const booking = bookingFromVendor(vendor);
const file = { id: "f1", name: "Quote.pdf", url: "https://example.com/q.pdf", size: 1000, mime: "application/pdf", fromVendor: false };
const pageWith = (filesHeld: boolean, files: BookingPage["files"]): BookingPage => ({
  today: "2026-10-22",
  booking,
  funders: [],
  categories: ["Decoration"],
  files,
  filesHeld,
  partFiles: {},
});

function show() {
  const html = renderToStaticMarkup(<BookingScreen bookingId="vendor-kebun" />);
  links.findLast((l) => l.label === REMOVE_BOOKING)?.onClick?.();
  return { html, body: asked.at(-1)?.body ?? "" };
}

const filesHeading = (html: string) => html.match(/<h2[^>]*><span>Files<\/span>(<small>[^<]*<\/small>)?<\/h2>/)?.[0];

beforeEach(() => {
  asked = [];
  links = [];
});

describe("a booking whose files haven't arrived (P7-S15)", () => {
  it("gives the Files heading no count, and asks to remove it with its files, uncounted", async () => {
    page = pageWith(true, []);
    const { html, body } = show();
    expect(filesHeading(html)).toBeDefined();
    expect(filesHeading(html)).not.toContain("<small>");
    expect(body).toContain("with its files.");
  });

  it("once they arrive, counts them in both, or says None yet and leaves them out", () => {
    page = pageWith(false, [file]);
    let shown = show();
    expect(filesHeading(shown.html)).toContain("<small>1 file</small>");
    expect(shown.body).toContain("with its 1 file.");

    page = pageWith(false, []);
    shown = show();
    expect(filesHeading(shown.html)).toContain("<small>None yet</small>");
    expect(shown.body).not.toContain("file");
  });
});
