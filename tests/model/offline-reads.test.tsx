import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { vendorFromDoc, venueFromDoc } from "@/lib/data/adapters/bookings";
import { finalistFromDoc } from "@/lib/data/adapters/shortlist";
import type { Loaded } from "@/lib/data/settings";

// Phase 6 review P6-S15 and P6-S16: offline, a screen whose own content is in a
// read that hasn't arrived says it's offline, and a list keeps what it knows.
// The reads are stood in for by collection name; the hooks run as on a server render.

type Read = { data: unknown[]; loading: boolean; error: null; arrived: boolean };
const here = (data: unknown[]): Read => ({ data, loading: false, error: null, arrived: true });
const waiting: Read = { data: [], loading: true, error: null, arrived: false };
let reads: Record<string, Read> = {};

vi.mock("@/lib/use-collection", () => ({
  useCollection: (name: string) => reads[name] ?? here([]),
}));
vi.mock("@/lib/data/session", () => ({
  useSession: () => ({ connection: "offline" }),
}));

const { useVendor } = await import("@/lib/data/vendors");
const { useVenue } = await import("@/lib/data/venues");
const { useFinalists } = await import("@/lib/data/shortlist");
const { useBooking } = await import("@/lib/data/use-booking");

function run<T>(hook: () => Loaded<T>): Loaded<T> {
  let out: Loaded<T> | null = null;
  function Probe() {
    out = hook();
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return out!;
}

const kebun = vendorFromDoc("kebun", { name: "Kebun Bunga Atelier", category: "Decoration", contractStatus: "Considering" });
const lestari = vendorFromDoc("lestari", { name: "Dapur Lestari Catering", category: "Catering", contractStatus: "Chosen" });
const booked = finalistFromDoc("f-lestari", {
  name: "Dapur Lestari Catering",
  category: "Catering",
  sourceVendorId: "lestari",
  movedTo: { kind: "booking", id: "vendor-lestari" },
});

beforeEach(() => {
  reads = {};
});

describe("offline, before a page's own reads arrive (P6-S15)", () => {
  it("a vendor waits for its finalist and files, so it doesn't offer Copy to the shortlist or show no files", () => {
    reads = { vendors: here([kebun]), shortlist: waiting };
    expect(run(() => useVendor("kebun"))).toEqual({ status: "offline", data: null });
    reads = { vendors: here([kebun]), shortlist: here([]), weddingFiles: waiting };
    expect(run(() => useVendor("kebun"))).toEqual({ status: "offline", data: null });
    reads = { vendors: here([kebun]), shortlist: here([]), weddingFiles: here([]) };
    expect(run(() => useVendor("kebun")).data?.vendor?.name).toBe("Kebun Bunga Atelier");
  });

  // Phase 8 review S2: an app opened offline may never hear the files (no stored cache), and the
  // list shows the venue, so its sheet shows it too and says the files are waiting.
  it("a venue's sheet shows the venue while its files wait, and says they're waiting", () => {
    reads = { venues: here([venueFromDoc("taman", { name: "Puri Taman Sari" })]), weddingFiles: waiting };
    const read = run(() => useVenue("taman"));
    expect(read.status).toBe("offline");
    expect(read.data?.venue?.name).toBe("Puri Taman Sari");
    expect(read.data?.filesHeld).toBe(true);
    reads = { venues: here([venueFromDoc("taman", { name: "Puri Taman Sari" })]), weddingFiles: here([]) };
    expect(run(() => useVenue("taman")).data?.filesHeld).toBe(false);
  });

  it("a venue's sheet still waits for the venues themselves", () => {
    reads = { venues: waiting, weddingFiles: waiting };
    expect(run(() => useVenue("taman"))).toEqual({ status: "offline", data: null });
  });

  it("the shortlist still shows, and a booked finalist still reads as booked while the vendors wait", () => {
    reads = { shortlist: here([booked]), vendors: waiting };
    const read = run(useFinalists);
    expect(read.status).toBe("offline");
    expect(read.data?.map((f) => [f.id, f.booked])).toEqual([["f-lestari", true]]);
    // Once the vendors are here they decide, as before.
    reads = { shortlist: here([booked]), vendors: here([lestari]) };
    expect(run(useFinalists).data?.[0].booked).toBe(true);
  });
});

describe("offline, a booking whose vendors haven't arrived (P6-S16)", () => {
  it("has no data, so the screen says it's offline, not that the booking isn't here", () => {
    reads = { vendors: waiting };
    expect(run(() => useBooking("vendor-lestari"))).toEqual({ status: "offline", data: null });
    reads = { vendors: here([lestari]) };
    expect(run(() => useBooking("vendor-lestari")).data?.booking?.name).toBe("Dapur Lestari Catering");
  });
});
