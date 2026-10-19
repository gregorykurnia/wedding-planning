import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_ACCOUNTS } from "../e2e/emulator-config";
import { FIXTURE_NAMES, type FixtureName } from "../fixtures";
import { loadFixture } from "../fixtures/load";
import { prototypeSets } from "../fixtures/prototype";
import { fileFromDoc, filesForRecord, folderItemFromDoc } from "@/lib/data/adapters/files";
import { vendorFromDoc, venueFromDoc } from "@/lib/data/adapters/bookings";
import { documentFromDoc } from "@/lib/data/adapters/documents";
import { finalistBookingId, finalistFromDoc } from "@/lib/data/adapters/shortlist";
import { guestFromDoc, numberGuests } from "@/lib/data/adapters/guests";
import { bookingsFrom } from "@/lib/model/bookings";
import { closeClient, makeClient, signIn, type Partner } from "./emulator";

// Task 5.1: each fixture set loads into the emulators, and the app's own readers
// make what the prototype shows out of it.

let counts: Record<string, number>;
let me: Partner;

async function open(name: FixtureName) {
  counts = await loadFixture(name);
  me = await signIn(makeClient(), TEST_ACCOUNTS[0]);
}

async function docsOf(name: string) {
  return (await getDocs(collection(me.db, name))).docs.map((d) => ({ id: d.id, data: d.data() }));
}

const records = async () => ({
  vendors: (await docsOf("vendors")).map((d) => vendorFromDoc(d.id, d.data)),
  venues: (await docsOf("venues")).map((d) => venueFromDoc(d.id, d.data)),
});

it("has a set for each name the command takes", () => {
  expect(FIXTURE_NAMES).toEqual(["normal", "empty", "stress"]);
});

describe("normal", () => {
  beforeAll(() => open("normal"), 120_000);
  afterAll(async () => {
    await closeClient(me);
  });

  it("loads every collection the prototype fills", () => {
    expect(counts).toMatchObject({
      vendors: 19,
      venues: 6,
      shortlist: 6,
      hypotheticalItems: 2,
      scheduleEvents: 11,
      todos: 7,
      guests: 20,
      masterListItems: 25,
      notes: 6,
      funders: 4,
    });
  });

  it("makes the prototype's ten bookings, in parts or whole, with the money it shows", async () => {
    const { vendors, venues } = await records();
    const bookings = bookingsFrom(vendors, venues);
    expect(bookings).toHaveLength(prototypeSets().NORMAL.bookings.length);
    const byName = new Map(bookings.map((b) => [b.name, b]));
    const lestari = byName.get("Dapur Lestari Catering")!;
    expect(lestari.parts.map((p) => [p.name, p.price, p.paid])).toEqual([
      ["Deposit", 50_000_000, 50_000_000],
      ["Second instalment", 55_500_000, 0],
      ["Final payment", 55_500_000, 0],
    ]);
    expect(lestari).toMatchObject({ category: "Food", kind: "vendor", from: "vendor", bookedOn: "2026-08-11", estimate: 150_000_000 });
    expect(byName.get("Villa Samaya Ubud")).toMatchObject({ kind: "venue", category: "Venue", estimate: 380_000_000 });
    expect(byName.get("Villa Samaya Ubud")!.parts).toHaveLength(3);
    expect(byName.get("Kirana Makeup")).toMatchObject({ price: 18_500_000, paid: 20_000_000 });
    expect(byName.get("Paper & Peony")).toMatchObject({ direct: true, funder: null, due: "2026-10-21" });
    expect(byName.get("Rumah Cincin")).toMatchObject({ direct: true, price: 46_000_000, paid: 46_000_000 });
  });

  it("keeps vendors that aren't booked out of the bookings, and reads their stage and price options", async () => {
    const { vendors } = await records();
    const sendok = vendors.find((v) => v.name === "Sendok Emas Catering")!;
    expect(sendok).toMatchObject({ contractStatus: "Consideration", keen: true, booking: null });
    expect(sendok.priceOptions.map((o) => [o.description, o.selected])).toEqual([["Package A", true], ["Package B", false]]);
    expect(vendors.find((v) => v.name === "Rasa Nusantara")!.contractStatus).toBe("Rejected");
  });

  it("makes finalists with their packages, and ties a moved one to its booking", async () => {
    const { vendors } = await records();
    const finalists = (await docsOf("shortlist")).map((d) => finalistFromDoc(d.id, d.data));
    const sendok = finalists.find((f) => f.id === "f-sendok")!;
    expect(sendok.packages.map((p) => [p.name, p.price])).toEqual([["Package A", 150_000_000], ["Package B", 172_000_000]]);
    expect(sendok.preferredPackageId).toBe("main");
    const lestari = finalists.find((f) => f.id === "f-lestari")!;
    expect(finalistBookingId(lestari, new Map(vendors.map((v) => [v.id, v])))).toBe("vendor-lestari");
    expect(finalists.find((f) => f.id === "f-arka")!.sourceVendorId).toBeNull();
  });

  it("numbers the guests from 1 and reads their invitation and answer", async () => {
    const guests = numberGuests((await docsOf("guests")).map((d) => guestFromDoc(d.id, d.data)));
    expect(guests.map((g) => g.number).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(guests.every((g) => g.numberStored)).toBe(true);
    expect(guests.find((g) => g.name === "Kevin Hartono")).toMatchObject({ eventType: "Unsure (Abroad)", rsvpStatus: "pending", inviteSent: false, plusOnes: 1 });
    expect((await getDoc(doc(me.db, "guestMeta", "counter"))).data()!.next).toBe(21);
  });

  it("stores items by event and person as the old screen did, and General as no one", async () => {
    const items = await docsOf("masterListItems");
    const mothers = items.find((d) => d.data.item === "Makeup for both mothers")!.data;
    expect(mothers).toMatchObject({ types: ["Reception"], persons: ["Bride Mom", "Groom Mom"], confirmed: true });
    expect(items.find((d) => d.data.item === "Catering")!.data.persons).toEqual([]);
    expect((await getDoc(doc(me.db, "masterListMeta", "initialization"))).data()).toMatchObject({ initialized: true, nextSortOrder: 25 });
  });

  it("reads each document, with its table, its total's formula and who saved it", async () => {
    const notes = await docsOf("notes");
    const meeting = documentFromDoc("kebun-meeting", notes.find((d) => d.id === "kebun-meeting")!.data);
    expect(meeting.content.type).toBe("doc");
    expect(JSON.stringify(meeting.content)).toContain("=SUM(C2:C5)");
    expect(meeting.updatedBy).toBe(me.uid);
    const scratch = notes.find((d) => d.id === "scratch")!.data;
    expect(scratch.updatedBy).not.toBe(me.uid);
  });

  it("makes the Files tree, and the files attached to a record", async () => {
    const folders = (await docsOf("fileFolders")).map((d) => folderItemFromDoc(d.id, d.data));
    expect(folders.find((f) => f.id === "old")).toMatchObject({ name: "Old quotes", parentId: "catering" });
    const files = (await docsOf("weddingFiles")).map((d) => fileFromDoc(d.id, d.data));
    expect(files).toHaveLength(counts.weddingFiles);
    expect(filesForRecord([{ kind: "vendor", id: "lestari" }], files, []).map((f) => f.name)).toEqual(["Catering quote, 400 guests.pdf"]);
    expect(filesForRecord([{ kind: "finalist", id: "f-kebun" }], files, [])).toEqual([]);
    expect(files.find((f) => f.name === "Moodboard.png" && f.recordRef)!.url).toMatch(/^data:image\/svg\+xml/);
  });

  it("names the couple and leaves the accounts paired", async () => {
    const wedding = (await getDoc(doc(me.db, "settings", "wedding"))).data()!;
    expect(wedding).toMatchObject({ yourName: "Greg", partnerName: "Bella", weddingDate: "2027-03-20", venue: "Villa Samaya Ubud" });
    const slots = (await getDoc(doc(me.db, "settings", "accounts"))).data()!.slots;
    expect(slots[me.uid]).toBe("first");
    expect(Object.values(slots).sort()).toEqual(["first", "second"]);
  });
});

describe("empty", () => {
  beforeAll(() => open("empty"), 120_000);
  afterAll(async () => {
    await closeClient(me);
  });

  it("keeps the couple, who pays and the categories, and plans nothing", async () => {
    expect(counts).toEqual({ settings: 1, members: 2, funders: 4, vendorCategories: 4 });
    for (const name of ["vendors", "venues", "shortlist", "guests", "masterListItems", "masterListMeta", "notes", "weddingFiles", "todos", "scheduleEvents"]) {
      expect(await docsOf(name), name).toEqual([]);
    }
    expect((await getDoc(doc(me.db, "settings", "wedding"))).exists()).toBe(true);
  });
});

describe("stress", () => {
  beforeAll(() => open("stress"), 180_000);
  afterAll(async () => {
    await closeClient(me);
  });

  it("loads thousands of records, as many as the prototype's stress set has", async () => {
    const set = prototypeSets().STRESS;
    expect(counts).toMatchObject({
      guests: set.guests.length,
      masterListItems: set.items.length,
      scheduleEvents: set.events.length,
      todos: set.tasks.length,
      notes: set.docs.length,
      shortlist: set.finalists.length,
      hypotheticalItems: set.whatifs.length,
      funders: set.funders.length,
    });
    const { vendors, venues } = await records();
    expect(bookingsFrom(vendors, venues)).toHaveLength(set.bookings.length);
    expect(vendors.length).toBeGreaterThanOrEqual(set.vendors.length);
    expect(venues.length).toBeGreaterThanOrEqual(set.venues.length);
    expect(counts.weddingFiles).toBeGreaterThanOrEqual(set.files.length);
  }, 120_000);

  it("keeps the very long, non-Latin and empty values, and the deep document", async () => {
    const { vendors } = await records();
    expect(vendors.some((v) => v.name.startsWith("婚礼摄影工作室"))).toBe(true);
    expect(vendors.some((v) => v.name.length > 70)).toBe(true);
    const long = documentFromDoc("s-long", (await getDoc(doc(me.db, "notes", "s-long"))).data()!);
    expect(long.content.type).toBe("doc");
    expect(JSON.stringify(long.content).length).toBeGreaterThan(20_000);
    const folders = (await docsOf("fileFolders")).map((d) => folderItemFromDoc(d.id, d.data));
    expect(folders.filter((f) => f.id.startsWith("deep"))).toHaveLength(30);
  }, 120_000);
});
