import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addVenue, removeVenueFromList, setVenueField, setVenueStage } from "@/lib/data/venues";
import { WriteError } from "@/lib/data/write-error";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

// Task 4.15: the Venues screen's writes, against the emulators (guide §5.15).

let gregory: Partner;
let bella: Partner;

beforeAll(async () => {
  [gregory, bella] = await twoPartners();
});

afterAll(async () => {
  await Promise.all([closeClient(gregory), closeClient(bella)]);
});

beforeEach(async () => {
  await clearFirestore();
});

const g = () => ({ db: gregory.db });
const b = () => ({ db: bella.db });

async function read(col: string, id: string) {
  return (await getDoc(doc(gregory.db, col, id))).data();
}

const input = (over: Record<string, string | number | null> = {}) => ({
  id: "ven-new",
  name: "  Bukit Jimbaran Lawn ",
  location: " Jimbaran, Bali ",
  cost: 295_000_000 as number | null,
  guests: 350 as number | null,
  notes: "Ask about the rain plan",
  stage: "Shortlist",
  ...over,
});

/** The activity entries are written without waiting, so poll for them. */
async function activityOf(kind: string) {
  for (let i = 0; i < 40; i++) {
    const snap = await getDocs(query(collection(gregory.db, "activity"), where("kind", "==", kind)));
    if (!snap.empty) return snap.docs.map((d) => d.data());
    await new Promise((r) => setTimeout(r, 100));
  }
  return [];
}

describe("addVenue", () => {
  it("adds the venue in the fields both UIs read", async () => {
    const done = await addVenue(input() as never, "2026-10-18", g());
    expect(done.becameBooking).toBe(false);
    expect(await read("venues", "ven-new")).toMatchObject({
      name: "Bukit Jimbaran Lawn",
      location: "Jimbaran, Bali",
      budgetEstimate: 295_000_000,
      guestMax: 350,
      status: "Shortlist",
      notes: "Ask about the rain plan",
      confirmedType: "Venue",
      funder: null,
      budgetSpent: 0,
      files: [],
      subEntries: [],
      createdBy: gregory.uid,
    });
    expect((await read("venues", "ven-new"))?.booking).toBeUndefined();
    expect(await activityOf("venue.added")).toEqual([
      expect.objectContaining({ params: { name: "Bukit Jimbaran Lawn" }, target: { kind: "venue", id: "ven-new" } }),
    ]);
  });

  it("saves an empty cost or capacity as 0, the way the old screens do", async () => {
    await addVenue(input({ cost: null, guests: null }) as never, "2026-10-18", g());
    expect(await read("venues", "ven-new")).toMatchObject({ budgetEstimate: 0, guestMax: 0 });
  });

  it("makes a venue added as Booked a booking from the start, with the estimate kept apart", async () => {
    const done = await addVenue(input({ stage: "Booked" }) as never, "2026-10-18", g());
    expect(done.becameBooking).toBe(true);
    expect(await read("venues", "ven-new")).toMatchObject({
      status: "Booked",
      budgetEstimate: 295_000_000,
      agreedPrice: 295_000_000,
      booking: { on: "2026-10-18", from: "venue", removed: false },
    });
    expect(await activityOf("venue.booked")).toEqual([
      expect.objectContaining({ params: { name: "Bukit Jimbaran Lawn" }, target: { kind: "booking", id: "venue-ven-new" } }),
    ]);
  });

  it("writes the same record when it is tried again, so a retry never duplicates", async () => {
    await addVenue(input() as never, "2026-10-18", g());
    await addVenue(input({ notes: "Tried again" }) as never, "2026-10-18", g());
    const all = await getDocs(collection(gregory.db, "venues"));
    expect(all.size).toBe(1);
    expect(all.docs[0].data().notes).toBe("Tried again");
  });

  it("undo removes the venue again", async () => {
    const { undo } = await addVenue(input() as never, "2026-10-18", g());
    await undo();
    expect((await getDoc(doc(gregory.db, "venues", "ven-new"))).exists()).toBe(false);
    expect(await activityOf("venue.removed")).toHaveLength(1);
  });

  it("refuses to undo once the venue has grown, and leaves it as it is", async () => {
    const { undo } = await addVenue(input() as never, "2026-10-18", g());
    await updateDoc(doc(bella.db, "venues", "ven-new"), {
      files: [{ name: "Brochure.pdf", url: "https://example.com/b.pdf" }],
    });
    await expect(undo()).rejects.toMatchObject({ code: "changed" });
    await expect(undo()).rejects.toBeInstanceOf(WriteError);
    expect(await read("venues", "ven-new")).toMatchObject({ name: "Bukit Jimbaran Lawn" });
  });
});

describe("setVenueField", () => {
  it("saves each field under the name the old screens read, and a cleared number as 0", async () => {
    await setDoc(doc(gregory.db, "venues", "ven1"), { name: "Villa", budgetEstimate: 1, guestMax: 2 });
    await setVenueField("ven1", "name", "Villa Samaya", g());
    await setVenueField("ven1", "location", "Ubud", g());
    await setVenueField("ven1", "cost", 250_000_000, b());
    await setVenueField("ven1", "guests", 300, b());
    await setVenueField("ven1", "notes", "Pool", b());
    expect(await read("venues", "ven1")).toMatchObject({
      name: "Villa Samaya",
      location: "Ubud",
      budgetEstimate: 250_000_000,
      guestMax: 300,
      notes: "Pool",
      updatedBy: bella.uid,
    });
    await setVenueField("ven1", "cost", null, g());
    await setVenueField("ven1", "guests", null, g());
    expect(await read("venues", "ven1")).toMatchObject({ budgetEstimate: 0, guestMax: 0 });
  });
});

describe("setVenueStage", () => {
  const venue = { name: "Villa Samaya", status: "Toured", budgetEstimate: 250_000_000, guestMax: 300 };

  it("moves the stage and undoes it", async () => {
    await setDoc(doc(gregory.db, "venues", "ven1"), venue);
    const done = await setVenueStage("ven1", "Contacted", "2026-10-18", g());
    expect(done.becameBooking).toBe(false);
    expect(await read("venues", "ven1")).toMatchObject({ status: "Contacted" });
    await done.undo();
    expect(await read("venues", "ven1")).toMatchObject({ status: "Toured" });
  });

  it("makes the venue a booking when it becomes Booked, once", async () => {
    await setDoc(doc(gregory.db, "venues", "ven1"), venue);
    const first = await setVenueStage("ven1", "Booked", "2026-10-18", g());
    expect(first.becameBooking).toBe(true);
    expect(await read("venues", "ven1")).toMatchObject({
      status: "Booked",
      agreedPrice: 250_000_000,
      booking: { on: "2026-10-18", from: "venue", removed: false },
    });
    // Away from Booked and back keeps the booking as it was and doesn't announce a second one.
    await setVenueStage("ven1", "Toured", "2026-10-19", g());
    const again = await setVenueStage("ven1", "Booked", "2026-10-20", g());
    expect(again.becameBooking).toBe(false);
    expect(await read("venues", "ven1")).toMatchObject({ status: "Booked", booking: { on: "2026-10-18", from: "venue", removed: false } });
    expect(await activityOf("venue.booked")).toHaveLength(1);
  });
});

describe("removeVenueFromList", () => {
  it("removes a venue that is no booking, and undo puts it back as it was", async () => {
    await setDoc(doc(gregory.db, "venues", "ven2"), { name: "Puri Taman Sari", status: "Toured", budgetEstimate: 180_000_000 });
    const { undo } = await removeVenueFromList("ven2", g());
    expect((await getDoc(doc(gregory.db, "venues", "ven2"))).exists()).toBe(false);
    expect(await activityOf("venue.removed")).toEqual([
      expect.objectContaining({ params: { name: "Puri Taman Sari" }, target: { kind: "venue", id: "ven2" } }),
    ]);
    await undo();
    expect(await read("venues", "ven2")).toMatchObject({ name: "Puri Taman Sari", status: "Toured", budgetEstimate: 180_000_000 });
  });

  it("leaves a booked venue in the budget as a direct booking, and undo makes it a venue again", async () => {
    await setDoc(doc(gregory.db, "venues", "ven1"), {
      name: "Villa Samaya",
      status: "Booked",
      budgetEstimate: 250_000_000,
      agreedPrice: 250_000_000,
      budgetSpent: 50_000_000,
      booking: { on: "2026-09-01", from: "venue", removed: false },
    });
    const { undo } = await removeVenueFromList("ven1", g());
    expect(await read("venues", "ven1")).toMatchObject({
      budgetSpent: 50_000_000,
      booking: { on: "2026-09-01", from: "direct", removed: false },
    });
    await undo();
    expect(await read("venues", "ven1")).toMatchObject({ booking: { on: "2026-09-01", from: "venue", removed: false } });
  });
});
