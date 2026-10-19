import { contentFields } from "@/lib/data/adapters/documents";
import { BUILT_IN_CATEGORIES, OTHER_CATEGORY } from "@/lib/model/categories";
import { RECORD_ROOT_FOLDER, type RecordKind } from "@/lib/data/adapters/files";
import { htmlToDoc } from "./html";
import type { ProtoBooking, ProtoFile, ProtoPart, ProtoSet, ProtoVendor, ProtoVenue } from "./prototype";

/**
 * The prototype's sets as the planner stores them: the same collections and
 * fields the app's own writes make (a booking is a vendor or venue with a
 * `booking` mark, a finalist is a `shortlist` document, a document body is
 * Tiptap JSON), so every screen reads a fixture the way it reads real data.
 * Names are the stored ones where the prototype shows its own words (its
 * "Catering" is stored "Food"; `src/lib/model/labels.ts` maps them back).
 */

export interface FixtureAccount {
  uid: string;
  email: string;
}

/** The two signed-in test accounts: the first holds the first name (`seed()` pairs them). */
export interface FixtureContext {
  me: FixtureAccount;
  partner: FixtureAccount;
}

/** collection → document id → fields. Dates are `Date`s (stored as timestamps). */
export type FixtureDocs = Record<string, Record<string, Record<string, unknown>>>;

type Doc = Record<string, unknown>;

const BASE = Date.UTC(2026, 2, 1, 8);
const at = (index: number) => new Date(BASE + index * 1000);
const onDay = (iso: string, index = 0) => new Date(Date.parse(`${iso}T08:00:00Z`) + index);
const stamped = (when: Date, by: string): Doc => ({ createdAt: when, createdBy: by, updatedAt: when, updatedBy: by });

const STORED_CATEGORY: Record<string, string> = {
  Catering: "Food",
  "Photo and video": "Photos and Videos",
  "Bride's attire": "Bride Dress",
  "Groom's attire": "Groom Suit",
  Music: "Music/DJ",
  Makeup: "Makeup Artist",
  Invitations: "Invites",
  Transport: "Transportation",
  "Wedding cake": "Wedding Cake",
};
const category = (name: string) => STORED_CATEGORY[name] ?? (name.trim() || OTHER_CATEGORY);

const VENDOR_STATUS = { noted: "List", asking: "Inquiring", considering: "Consideration", chosen: "Chosen", done: "Done", out: "Rejected" } as const;
const VENUE_STATUS = { noted: "Shortlist", contacted: "Contacted", visited: "Toured", booked: "Booked", out: "Rejected" } as const;
const GUEST_EVENT = { both: "Both", ceremony: "Matrimony", reception: "Reception", maybe: "Reception Shortlist", unsure: "Unsure (Abroad)" } as const;
const ITEM_EVENT: Record<string, string> = { reception: "Reception", matrimony: "Matrimony", sangjit: "Sangjit", prewed: "Pre-Wedding" };
const ITEM_PERSON: Record<string, string> = {
  groom: "Groom",
  bride: "Bride",
  "g-father": "Groom Dad",
  "g-mother": "Groom Mom",
  "g-brother": "Groom Brother",
  "g-sister": "Groom Sister",
  "b-father": "Bride Dad",
  "b-mother": "Bride Mom",
  "b-brothers": "Bride Brothers",
};
const REMINDER_MINUTES: Record<string, number> = { "1d": 1440, "7d": 10080 };

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  zip: "application/zip",
};
const TYPE_MIME: Record<string, string> = { pdf: MIME.pdf, image: MIME.png, doc: MIME.docx, sheet: MIME.xlsx, zip: MIME.zip };
const mimeOf = (name: string, type: string) => MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? TYPE_MIME[type] ?? "application/octet-stream";

/** "2,4 MB", "640 KB" or "1 KB" as bytes. */
function sizeBytes(text: string): number {
  const [amount, unit] = text.split(" ");
  const value = Number(amount.replace(",", "."));
  return Math.round(value * (unit === "KB" ? 1_000 : 1_000_000));
}

const withoutNulls = (doc: Doc): Doc => Object.fromEntries(Object.entries(doc).filter(([, v]) => v !== null && v !== undefined));

function payments(id: string, paid: number, funder: string | null, on: string) {
  return paid > 0 ? [{ id: `pay-${id}`, amount: paid, paidOn: on, funder, receiptFileId: null }] : [];
}

function part(p: ProtoPart, on: string): Doc {
  return {
    id: p.id,
    name: p.name,
    funder: p.funder,
    totalPrice: p.price,
    budgetSpent: p.paid,
    nextTargetDate: p.due,
    nextAction: p.step,
    files: [],
    payments: payments(p.id, p.paid, p.funder, on),
  };
}

/** The money and `booking` mark of a booking, in the fields of the vendor or venue that holds it. */
function bookingFields(b: ProtoBooking, kind: "vendor" | "venue"): Doc {
  const mark = { on: b.origin.on, from: b.origin.from, removed: false };
  const on = b.origin.on ?? "2026-09-01";
  const inParts = Boolean(b.parts);
  const price = inParts ? 0 : (b.price ?? 0);
  return {
    booking: mark,
    ...(kind === "vendor" ? { totalPrice: price, estimate: b.estimate } : { agreedPrice: price, budgetEstimate: b.estimate ?? 0 }),
    funder: inParts ? null : (b.funder ?? null),
    budgetSpent: inParts ? 0 : (b.paid ?? 0),
    nextTargetDate: inParts ? null : (b.due ?? null),
    nextAction: inParts ? "" : (b.step ?? ""),
    subEntries: (b.parts ?? []).map((p) => part(p, on)),
    payments: inParts ? [] : payments("1", b.paid ?? 0, b.funder ?? null, on),
  };
}

function vendorBase(v: ProtoVendor): Doc {
  return {
    name: v.name,
    category: category(v.category),
    contactName: v.contact,
    contactPhone: v.phone,
    contactEmail: "",
    contractStatus: VENDOR_STATUS[v.stage],
    priceOptions: v.prices.map((o) => ({ id: o.id, description: o.name, includes: o.includes, price: o.price, selected: o.preferred })),
    notes: v.notes,
    starred: v.keen,
    images: [],
    files: [],
    bridestoryRating: v.rating,
    bridestoryReviewCount: v.reviewers,
    confirmedType: category(v.category),
    funder: null,
    totalPrice: 0,
    budgetSpent: 0,
    nextTargetDate: null,
    nextAction: "",
    subEntries: [],
    booking: null,
    payments: [],
  };
}

/** A vendor made by Add a booking (or a booking from the Vendors list the prototype doesn't list). */
function bookedVendor(b: ProtoBooking): Doc {
  return {
    name: b.name,
    category: category(b.category),
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    contractStatus: "Chosen",
    priceOptions: [],
    notes: "",
    starred: false,
    images: [],
    files: [],
    bridestoryRating: null,
    bridestoryReviewCount: null,
    confirmedType: category(b.category),
    ...bookingFields(b, "vendor"),
  };
}

function venueBase(v: ProtoVenue): Doc {
  return {
    name: v.name,
    status: VENUE_STATUS[v.stage],
    funder: null,
    budgetEstimate: v.cost ?? 0,
    agreedPrice: null,
    budgetSpent: 0,
    nextTargetDate: null,
    nextAction: "",
    subEntries: [],
    booking: null,
    guestMax: v.capacity ?? 0,
    location: v.location,
    notes: v.notes,
    files: [],
    images: [],
    coverImage: null,
    confirmedType: "Venue",
    payments: [],
  };
}

function bookedVenue(b: ProtoBooking): Doc {
  return {
    name: b.name,
    status: "Booked",
    guestMax: 0,
    location: "",
    notes: "",
    files: [],
    images: [],
    coverImage: null,
    confirmedType: "Venue",
    ...bookingFields(b, "venue"),
  };
}

interface Attachment {
  kind: RecordKind;
  id: string;
  name: string;
  files: ProtoFile[];
}

/** Files attached to records go in a folder per record, under one per kind, as an upload makes them. */
function recordFiles(attachments: readonly Attachment[], existingRoots: ReadonlyMap<string, string>, owner: string, email: string) {
  const folders: Record<string, Doc> = {};
  const files: Record<string, Doc> = {};
  let n = 0;
  for (const a of attachments) {
    if (a.files.length === 0) continue;
    const rootName = RECORD_ROOT_FOLDER[a.kind];
    const rootId = existingRoots.get(rootName) ?? `record-root-${a.kind}`;
    if (!existingRoots.has(rootName)) folders[rootId] = { name: rootName, parentId: null, ...stamped(at(n), owner) };
    const folderId = `record-${a.kind}-${a.id}`;
    folders[folderId] = { name: a.name, parentId: rootId, recordRef: { kind: a.kind, id: a.id }, ...stamped(at(n + 1), owner) };
    for (const f of a.files) {
      const id = `rf-${a.kind}-${a.id}-${++n}`;
      files[id] = {
        name: f.name,
        category: "",
        description: "",
        folderId,
        url: f.src ?? `https://example.invalid/files/${id}/${encodeURIComponent(f.name)}`,
        publicId: `fixtures/${id}`,
        resourceType: f.type === "image" ? "image" : "raw",
        originalFilename: f.name,
        fileType: mimeOf(f.name, f.type),
        fileSize: sizeBytes(f.size),
        uploadedBy: email,
        recordRef: { kind: a.kind, id: a.id },
        ...stamped(at(n), owner),
      };
    }
  }
  return { folders, files };
}

/** Every file of the same name once, first one winning. */
const unionByName = (...lists: ProtoFile[][]) => {
  const seen = new Set<string>();
  return lists.flat().filter((f) => !seen.has(f.name) && (seen.add(f.name), true));
};

export function buildFixture(set: ProtoSet, ctx: FixtureContext): FixtureDocs {
  const me = ctx.me.uid;
  const partner = ctx.partner.uid;
  const who = (name: string) => (name === set.partner ? partner : me);
  const out: FixtureDocs = {};
  const put = (collection: string, id: string, doc: Doc) => {
    (out[collection] ??= {})[id] = doc;
  };

  // Settings, the two accounts, who pays and the categories.
  const bookedVenue1 = set.venues.find((v) => v.stage === "booked");
  put("settings", "wedding", {
    yourName: set.couple[0],
    partnerName: set.couple[1],
    weddingDate: set.wedding,
    partnerEmail: ctx.partner.email,
    venue: bookedVenue1?.name ?? "",
    startedOn: set.since,
    ...stamped(at(0), me),
  });
  for (const [i, account] of [ctx.me, ctx.partner].entries()) {
    put("members", account.uid, { email: account.email, provider: "password", lastSeenAt: at(i) });
  }
  set.funders.forEach((f, i) => put("funders", f.id, { name: f.name, order: i, ...stamped(at(i), me) }));
  const known = new Set<string>([...BUILT_IN_CATEGORIES, OTHER_CATEGORY, "Venue"].map((c) => c.toLowerCase()));
  const custom = [...set.vendorCats.map((c) => c.name), ...set.categories].map(category).filter((c) => {
    const key = c.toLowerCase();
    return known.has(key) ? false : (known.add(key), true);
  });
  custom.forEach((name, i) => put("vendorCategories", `category-${i}`, { name, ...stamped(at(i), me) }));

  // Vendors, venues and the bookings they hold.
  const vendorIds = new Set(set.vendors.map((v) => v.id));
  const venueIds = new Set(set.venues.map((v) => v.id));
  const bookingOf = new Map(set.bookings.map((b) => [b.id, b]));
  const attachments: Attachment[] = [];
  set.vendors.forEach((v, i) => {
    const b = bookingOf.get(v.id);
    const doc = { ...vendorBase(v), ...(b && b.origin.from !== "venue" ? bookingFields(b, "vendor") : {}) };
    put("vendors", v.id, { ...doc, ...stamped(onDay(v.added, i), me) });
    attachments.push({ kind: "vendor", id: v.id, name: v.name, files: unionByName(v.files, b?.files ?? []) });
  });
  set.venues.forEach((v, i) => {
    const b = bookingOf.get(v.id);
    const doc = { ...venueBase(v), ...(b && b.origin.from === "venue" ? bookingFields(b, "venue") : {}) };
    put("venues", v.id, { ...doc, ...stamped(at(i), me) });
    attachments.push({ kind: "venue", id: v.id, name: v.name, files: unionByName(v.files, b?.files ?? []) });
  });
  set.bookings.forEach((b, i) => {
    const merged = b.origin.from === "venue" ? venueIds.has(b.id) : vendorIds.has(b.id);
    if (merged) return;
    const when = b.origin.on ? onDay(b.origin.on, i) : at(i);
    if (b.origin.from === "venue") {
      put("venues", b.id, { ...bookedVenue(b), ...stamped(when, me) });
      attachments.push({ kind: "venue", id: b.id, name: b.name, files: b.files });
    } else {
      put("vendors", b.id, { ...bookedVendor(b), ...stamped(when, me) });
      attachments.push({ kind: "booking", id: `vendor-${b.id}`, name: b.name, files: b.files });
    }
  });

  // The shortlist: the first package is the finalist's own price, the rest its packages.
  set.finalists.forEach((f, i) => {
    const [main, ...rest] = f.packages;
    const preferred = f.packages.find((p) => p.preferred);
    put("shortlist", f.id, {
      name: f.name,
      type: category(f.category),
      contactName: f.contact,
      contactPhone: f.phone,
      price: main?.price ?? 0,
      priceDescription: main?.name ?? "",
      includes: main?.includes ?? "",
      bridestoryReviewers: f.reviews,
      igFollowers: f.followers,
      nextAction: f.step,
      notes: f.notes,
      files: [],
      subEntries: rest.map((p) => ({
        id: p.id,
        name: p.name,
        type: category(f.category),
        price: p.price,
        priceDescription: p.name,
        includes: p.includes,
        bridestoryReviewers: p.reviews,
        igFollowers: f.followers,
        nextAction: p.step,
        notes: p.notes,
        files: [],
      })),
      preferredPackageId: preferred && preferred !== main ? preferred.id : "main",
      sourceVendorId: f.vendor,
      ...(f.moved === "booking" && f.vendor ? { movedTo: { kind: "booking", id: `vendor-${f.vendor}` } } : {}),
      ...stamped(at(i), me),
    });
    attachments.push({ kind: "finalist", id: f.id, name: f.name, files: f.files.filter((file) => !file.fromVendor) });
  });

  // What-ifs.
  set.whatifs.forEach((w, i) => {
    put("hypotheticalItems", w.id, {
      name: w.name,
      type: category(w.category),
      totalPrice: w.parts ? 0 : (w.price ?? 0),
      funder: w.parts ? null : (w.funder ?? null),
      budgetSpent: 0,
      nextTargetDate: null,
      nextAction: "",
      files: [],
      subEntries: (w.parts ?? []).map((p) => ({ id: p.id, name: p.name, totalPrice: p.price, funder: p.funder })),
      ...stamped(at(i), me),
    });
  });

  // Schedule and tasks.
  set.events.forEach((e, i) => {
    const venue = e.related && venueIds.has(e.related) ? e.related : null;
    put("scheduleEvents", e.id, {
      title: e.title,
      type: e.kind.replace("-", "_"),
      startAt: e.start ? `${e.date}T${e.start}` : e.date,
      endAt: e.start && e.end ? `${e.date}T${e.end}` : null,
      allDay: !e.start,
      notes: e.notes,
      location: e.where,
      status: e.status,
      relatedVendorId: e.related && !venue ? e.related : null,
      relatedVenueId: venue,
      reminderMinutes: e.remind ? [REMINDER_MINUTES[e.remind] ?? Number(e.remind)] : [],
      remindersSent: [],
      ...stamped(at(i), me),
    });
  });
  set.tasks.forEach((t, i) => {
    put("todos", t.id, {
      title: t.title,
      notes: t.notes,
      dueDate: t.due,
      done: t.done,
      ...("doneOn" in t ? { doneOn: t.doneOn ?? null } : {}),
      subtasks: t.steps.map((s) => ({ id: s.id, title: s.title, notes: "", dueDate: s.due, done: s.done })),
      ...stamped(at(i), me),
    });
  });

  // Guests and wedding items.
  set.guests.forEach((g, i) => {
    put("guests", `guest-${g.no}`, {
      number: g.no,
      name: g.name,
      connection: g.conn,
      country: g.country,
      allergies: g.food,
      rsvpStatus: g.rsvp === "waiting" ? "pending" : g.rsvp,
      eventType: GUEST_EVENT[g.invite],
      inviteSent: g.sent,
      plusOnes: g.plus,
      ...stamped(at(i), me),
    });
  });
  if (set.guests.length) put("guestMeta", "counter", { next: Math.max(...set.guests.map((g) => g.no)) + 1, ...stamped(at(0), me) });
  set.items.forEach((it, i) => {
    put("masterListItems", it.id, {
      id: it.id,
      item: it.name,
      vendor: it.vendor ?? "",
      confirmed: it.confirmed,
      types: it.events.map((e) => ITEM_EVENT[e]).filter(Boolean),
      persons: it.people.map((p) => ITEM_PERSON[p]).filter(Boolean),
      next: it.next,
      sortOrder: i,
      createdAt: at(i),
      updatedAt: at(i),
    });
  });
  // A list that has been started has its marker; with none, Wedding items opens as a first use.
  if (set.items.length) put("masterListMeta", "initialization", { initialized: true, nextSortOrder: set.items.length, version: 1, ...stamped(at(0), me) });

  // Documents.
  for (const d of set.docs) {
    const when = new Date(d.updated);
    put("notes", d.id, { title: d.title, ...withoutNulls(contentFields(htmlToDoc(d.html), null)), ...stamped(when, who(d.by)) });
  }

  // Files and folders: the Files screen's own, then the ones attached to records.
  const roots = new Map(set.folders.filter((f) => f.parent === null).map((f) => [f.name, f.id]));
  set.folders.forEach((f, i) => put("fileFolders", f.id, { name: f.name, parentId: f.parent, ...stamped(at(i), me) }));
  for (const f of set.files) {
    put("weddingFiles", f.id, {
      name: f.name,
      category: f.category,
      description: f.desc,
      folderId: f.folder,
      url: f.src ?? `https://example.invalid/files/${f.id}/${encodeURIComponent(f.name)}`,
      publicId: `fixtures/${f.id}`,
      resourceType: f.type === "image" ? "image" : "raw",
      originalFilename: f.name,
      fileType: mimeOf(f.name, f.type),
      fileSize: Math.round(f.size * 1_000_000),
      uploadedBy: set.me.email,
      ...stamped(onDay(f.date), me),
    });
  }
  const attached = recordFiles(attachments, roots, me, set.me.email);
  for (const [id, doc] of Object.entries(attached.folders)) put("fileFolders", id, doc);
  for (const [id, doc] of Object.entries(attached.files)) put("weddingFiles", id, doc);

  return out;
}
