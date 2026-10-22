// Task 8.2: named changes to a loaded fixture, for the rows that need data the prototype's sets
// don't give on their own (a missing wedding date, a partner's change arriving). `apply(name)`
// writes through the Admin SDK to the emulator.
//
// A partner's change ("Bella's change arrives") is the prototype's own change to its set: the set is
// changed the way the prototype's `?state=sync` changes it, built into documents with the fixture
// builder, and the documents that differ from the unchanged set are written, plus the `activity`
// entry (as the partner) that makes the screen show its toast and flash.
import { FieldValue } from "firebase-admin/firestore";
import { connect } from "../../scripts/migrate/admin";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../e2e/emulator-config";
import { accountUids } from "../e2e/seed";
import { buildFixture, type FixtureContext, type FixtureDocs } from "../fixtures/build";
import { prototypeSets, type ProtoSet } from "../fixtures/prototype";

type Db = FirebaseFirestore.Firestore;
interface Who {
  me: string;
  partner: string;
}
type Patch = (db: Db, who: Who) => Promise<void>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

interface Entry {
  kind: string;
  params: Record<string, string | number | boolean | null>;
  target: { kind: string; id: string; partId?: string } | null;
}

/** Writes what `change` adds or alters in the normal set, and the partner's activity entry. */
function partnerChange(change: (set: ProtoSet) => void, entryOf: Entry | (() => Entry)): Patch {
  return async (db, who) => {
    const ctx: FixtureContext = {
      me: { uid: who.me, email: TEST_ACCOUNTS[0].email },
      partner: { uid: who.partner, email: TEST_ACCOUNTS[1].email },
    };
    const before = prototypeSets().NORMAL;
    const after = clone(before);
    change(after);
    const entry = typeof entryOf === "function" ? entryOf() : entryOf;
    const was: FixtureDocs = buildFixture(before, ctx);
    const now: FixtureDocs = buildFixture(after, ctx);
    const writer = db.bulkWriter();
    for (const [collection, byId] of Object.entries(now)) {
      for (const [id, data] of Object.entries(byId)) {
        if (!sameJson(was[collection]?.[id], data)) writer.set(db.collection(collection).doc(id), data).catch(() => {});
      }
    }
    // What the change took away.
    for (const [collection, byId] of Object.entries(was)) {
      for (const id of Object.keys(byId)) {
        if (!now[collection]?.[id]) writer.delete(db.collection(collection).doc(id)).catch(() => {});
      }
    }
    await writer.close();
    await db.collection("activity").add({
      by: who.partner,
      at: FieldValue.serverTimestamp(),
      kind: entry.kind,
      params: entry.params,
      target: entry.target,
      device: "partner-device",
      deviceKind: "computer",
    });
  };
}

const PATCHES: Record<string, Patch> = {
  // The couple haven't set the wedding date.
  nodate: async (db) => {
    await db.collection("settings").doc("wedding").update({ weddingDate: FieldValue.delete() });
  },
  // An empty folder called Rings at the top of Files (the prototype's "An empty folder").
  "empty-folder": async (db, who) => {
    await db.collection("fileFolders").doc("newf").set({ name: "Rings", parentId: null, createdAt: new Date(), createdBy: who.me, updatedAt: new Date(), updatedBy: who.me });
  },
  // Wedding items with nothing in them, but started (so it isn't the first-use screen).
  "items-started": async (db, who) => {
    await db.collection("masterListMeta").doc("initialization").set({
      initialized: true,
      nextSortOrder: 0,
      version: 1,
      createdAt: new Date(),
      createdBy: who.me,
      updatedAt: new Date(),
      updatedBy: who.me,
    });
  },
  // Bella records the second instalment to Dapur Lestari Catering (the prototype's `sync`).
  "sync-payment": partnerChange(
    (set) => {
      const part = set.bookings.find((b) => b.id === "lestari")?.parts?.find((p) => p.id === "p2");
      if (part) part.paid = part.price;
    },
    { kind: "payment.recorded", params: { amount: 55500000, name: "Dapur Lestari Catering" }, target: { kind: "booking", id: "vendor-lestari", partId: "p2" } },
  ),
  "sync-whatif": partnerChange(
    (set) => {
      set.whatifs.push({ id: "wsync", name: "Live band for the reception", category: "Music", price: 18000000, funder: set.funders[Math.min(1, set.funders.length - 1)]?.id ?? null });
    },
    { kind: "whatif.added", params: { name: "Live band for the reception" }, target: { kind: "whatif", id: "wsync" } },
  ),
  "sync-vendor": partnerChange(
    (set) => {
      set.vendors.push({ id: "melati", name: "Bunga Melati Florist", category: "Decoration", contact: "Ibu Wati", phone: "0812 5050 6060", stage: "noted", rating: null, reviewers: null, keen: false, added: "2026-10-14", prices: [], notes: "", files: [] });
    },
    { kind: "vendor.added", params: { name: "Bunga Melati Florist" }, target: { kind: "vendor", id: "melati" } },
  ),
  "sync-finalist": partnerChange(
    (set) => {
      set.finalists.push({
        id: "fsync",
        vendor: null,
        name: "Lumina Wedding Photography",
        category: "Photography",
        contact: "",
        phone: "",
        reviews: 64,
        followers: 8200,
        step: "Ask for the full-day price",
        notes: "",
        packages: [{ id: "k1", name: "Full day", price: 24000000, includes: "", reviews: null, step: "", notes: "", files: [] }],
        files: [],
      });
    },
    { kind: "finalist.added", params: { name: "Lumina Wedding Photography" }, target: { kind: "finalist", id: "fsync" } },
  ),
  "sync-venue": partnerChange(
    (set) => {
      set.venues.push({ id: "vsync", name: "Bukit Jimbaran Lawn", location: "Jimbaran, Bali", cost: 295000000, capacity: 350, stage: "noted", notes: "Found by Bella; ask about the rain plan.", files: [] });
    },
    { kind: "venue.added", params: { name: "Bukit Jimbaran Lawn" }, target: { kind: "venue", id: "vsync" } },
  ),
  "sync-document": partnerChange(
    (set) => {
      set.docs.push({ id: "playlist", title: "First dance shortlist", updated: "2026-10-14T11:02", by: set.partner, html: "<ol><li>Can't Help Falling in Love</li><li>Lucky</li></ol>" });
    },
    { kind: "document.added", params: { name: "First dance shortlist" }, target: { kind: "document", id: "playlist" } },
  ),
  "sync-event": partnerChange(
    (set) => {
      set.events.push({ id: "sync1", title: "Makeup trial with Kirana", kind: "appointment", date: "2026-10-15", start: "10:00", end: "12:00", allDay: false, related: "kirana", where: "Kirana Makeup, Sanur", notes: "", remind: "1d", status: "scheduled" });
    },
    { kind: "event.added", params: { name: "Makeup trial with Kirana", date: "2026-10-15", time: "10:00" }, target: { kind: "event", id: "sync1" } },
  ),
  "sync-task": partnerChange(
    (set) => {
      const task = set.tasks.find((t) => t.id === "t2") ?? set.tasks.find((t) => !t.done && t.steps.some((s) => !s.done));
      const step = task?.steps.find((s) => !s.done);
      if (step) step.done = true;
      changed = { id: task?.id ?? "t2", name: step?.title ?? "a step" };
    },
    () => ({ kind: "task.finished", params: { name: changed.name }, target: { kind: "task", id: changed.id } }),
  ),
  // Bella uploads a photo to the Files screen's top level (the prototype's `sync` in the folder you are in).
  "sync-file": partnerChange(
    (set) => {
      set.files.push({ id: "sx", name: "Bella's dress fitting.jpg", folder: null, size: 2.2, date: "2026-10-14", category: "Photo", desc: "Second fitting", type: "image" });
      changed = { id: "sx", name: "Bella's dress fitting.jpg" };
    },
    () => ({ kind: "file.uploaded", params: { name: changed.name }, target: { kind: "file", id: changed.id } }),
  ),
  // Bella removes the booking, or the document, you are looking at.
  "gone-booking": partnerChange(
    (set) => {
      set.bookings = set.bookings.filter((b) => b.id !== "lestari");
    },
    { kind: "booking.removed", params: { name: "Dapur Lestari Catering" }, target: { kind: "booking", id: "vendor-lestari" } },
  ),
  "gone-document": partnerChange(
    (set) => {
      set.docs = set.docs.filter((d) => d.id !== "kebun-meeting");
    },
    { kind: "document.deleted", params: { name: "Kebun Bunga meeting" }, target: { kind: "document", id: "kebun-meeting" } },
  ),
  "sync-item": partnerChange(
    (set) => {
      const item = set.items.find((i) => i.name === "Wedding cake");
      if (item) {
        item.confirmed = true;
        item.next = false;
        changed = { id: item.id, name: item.name };
      }
    },
    () => ({ kind: "item.confirmed", params: { name: changed.name }, target: { kind: "item", id: changed.id } }),
  ),
  "sync-guest": partnerChange(
    (set) => {
      const guest = set.guests.find((g) => g.rsvp === "waiting");
      if (guest) {
        guest.rsvp = "yes";
        changed = { id: `guest-${guest.no}`, name: guest.name };
      }
    },
    () => ({ kind: "guest.replied", params: { name: changed.name, reply: "yes" }, target: { kind: "guest", id: changed.id } }),
  ),
};

// What the last change touched, for the activity entry that describes it.
let changed = { id: "", name: "" };

export async function apply(name: string): Promise<void> {
  const patch = PATCHES[name];
  if (!patch) throw new Error(`No patch named "${name}"`);
  const [me, partner] = await accountUids();
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR;
  const { db } = connect("screenshots", EMULATOR_PROJECT_ID);
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Already in use in this process: it was set the first time.
  }
  await patch(db, { me, partner });
}
