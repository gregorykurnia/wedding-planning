/**
 * The one-time migrations of Task 1.11 (plan §2.7). Each only adds fields or
 * documents, so the old UI keeps reading the same data, and each plans nothing
 * on a second run. Legacy arrays (`files[]`) stay where they are.
 */
import type { DocumentSnapshot, Timestamp } from "firebase-admin/firestore";
import {
  cloudinaryAsset,
  recordFolderPath,
  RECORD_ROOT_FOLDER,
  sameRecord,
  type RecordRef,
} from "../../src/lib/data/adapters/files";
import { created, migrated, type Migration, type PlannedWrite } from "./plan";

const LEGACY_FUNDERS = ["CK", "Gregory", "Bella", "Bella Fam"];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Same ids as the app gives old elements saved without one (array-ops `withElementIds`). */
function withIds(raw: unknown): (Record<string, unknown> & { id: string })[] {
  if (!Array.isArray(raw)) return [];
  const out: (Record<string, unknown> & { id: string })[] = [];
  raw.forEach((entry, index) => {
    if (!isObject(entry)) return;
    out.push({ ...entry, id: typeof entry.id === "string" && entry.id ? entry.id : `legacy-${index}` });
  });
  return out;
}

function legacyFiles(raw: unknown): { name: string; url: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is { name: string; url: string } => isObject(f) && typeof f.name === "string" && typeof f.url === "string");
}

const update = (snap: DocumentSnapshot, data: Record<string, unknown>, note: string): PlannedWrite => ({
  kind: "update",
  ref: snap.ref,
  data: { ...data, ...migrated() },
  note,
  updateTime: snap.updateTime!,
});

const normalise = (name: unknown) => String(name ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

/* ---------- 1. funders ---------- */

const funders: Migration = {
  name: "1-funders",
  title: "Seed `funders` with the four old funders, their old strings as ids",
  async plan(db) {
    const writes: PlannedWrite[] = [];
    for (const [order, id] of LEGACY_FUNDERS.entries()) {
      const ref = db.doc(`funders/${id}`);
      if ((await ref.get()).exists) continue;
      writes.push({ kind: "create", ref, data: { name: id, order, ...created() }, note: `funder "${id}"` });
    }
    return { writes, report: [] };
  },
};

/* ---------- 2. guest numbers ---------- */

const guestNumbers: Migration = {
  name: "2-guest-numbers",
  title: "Number every guest in creation order, and set `guestMeta/counter`",
  async plan(db) {
    const guests = (await db.collection("guests").get()).docs;
    const valid = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;
    let max = guests.reduce((m, g) => (valid(g.get("number")) ? Math.max(m, g.get("number")) : m), 0);
    const millis = (g: DocumentSnapshot) => (g.get("createdAt") as Timestamp | undefined)?.toMillis?.() ?? Infinity;
    const writes: PlannedWrite[] = guests
      .filter((g) => !valid(g.get("number")))
      .sort((a, b) => millis(a) - millis(b) || a.id.localeCompare(b.id))
      .map((g) => {
        max += 1;
        return update(g, { number: max }, `guest "${g.get("name") ?? ""}" is number ${max}`);
      });
    const counter = await db.doc("guestMeta/counter").get();
    const next = counter.exists ? Number(counter.get("next")) || 0 : 0;
    if (next < max + 1) {
      writes.push({ kind: "merge", ref: counter.ref, data: { next: max + 1, ...migrated() }, note: `next guest number ${max + 1}` });
    }
    return { writes, report: [`${guests.length} guests, numbers up to ${max}`] };
  },
};

/* ---------- 3. bookings ---------- */

const bookings: Migration = {
  name: "3-bookings",
  title: "Mark every Chosen or Done vendor and every Booked venue as a booking; keep estimates apart",
  async plan(db) {
    const writes: PlannedWrite[] = [];
    for (const v of (await db.collection("vendors").get()).docs) {
      const data = v.data();
      if ("booking" in data || !["Chosen", "Done"].includes(data.contractStatus)) continue;
      const patch: Record<string, unknown> = { booking: { on: null, from: "vendor", removed: false } };
      if (!("estimate" in data)) {
        const leaning = withIds(data.priceOptions).find((o) => o.selected === true);
        patch.estimate = typeof leaning?.price === "number" ? leaning.price : null;
      }
      writes.push(update(v, patch, `vendor "${data.name ?? ""}" (${data.contractStatus}) is a booking`));
    }
    for (const v of (await db.collection("venues").get()).docs) {
      const data = v.data();
      if ("booking" in data || data.status !== "Booked") continue;
      const patch: Record<string, unknown> = { booking: { on: null, from: "venue", removed: false } };
      if (!("agreedPrice" in data)) patch.agreedPrice = typeof data.budgetEstimate === "number" ? data.budgetEstimate : 0;
      writes.push(update(v, patch, `venue "${data.name ?? ""}" is a booking`));
    }
    return { writes, report: [`${writes.length} bookings marked (booked on: not known, need N8)`] };
  },
};

/* ---------- 4. finalist sources ---------- */

const finalistSources: Migration = {
  name: "4-finalist-sources",
  title: "Link each finalist to the vendor with exactly the same name (`sourceVendorId`)",
  async plan(db) {
    const byName = new Map<string, { id: string; name: string }[]>();
    for (const v of (await db.collection("vendors").get()).docs) {
      const key = normalise(v.get("name"));
      if (!key) continue;
      byName.set(key, [...(byName.get(key) ?? []), { id: v.id, name: String(v.get("name")) }]);
    }
    const writes: PlannedWrite[] = [];
    const report: string[] = [];
    for (const f of (await db.collection("shortlist").get()).docs) {
      if ("sourceVendorId" in f.data()) continue;
      const matches = byName.get(normalise(f.get("name"))) ?? [];
      if (matches.length === 1) {
        writes.push(update(f, { sourceVendorId: matches[0].id }, `finalist "${f.get("name")}" copied from vendor ${matches[0].id}`));
      } else if (matches.length > 1) {
        report.push(
          `AMBIGUOUS: finalist "${f.get("name")}" (${f.id}) matches ${matches.length} vendors: ${matches.map((m) => m.id).join(", ")}. Not linked; choose one by hand.`,
        );
      }
    }
    return { writes, report };
  },
};

/* ---------- 5. legacy files ---------- */

interface FolderInfo {
  id: string;
  name: string;
  parentId: string | null;
  recordRef: RecordRef | null;
}

function readRef(raw: unknown): RecordRef | null {
  if (!isObject(raw) || typeof raw.kind !== "string" || typeof raw.id !== "string") return null;
  if (!["vendor", "venue", "booking", "finalist"].includes(raw.kind)) return null;
  return { kind: raw.kind as RecordRef["kind"], id: raw.id, ...(typeof raw.partId === "string" ? { partId: raw.partId } : {}) };
}

const legacyFilesMigration: Migration = {
  name: "5-legacy-files",
  title: "Put files attached to vendors, venues, finalists, packages and parts into Files, in folders named after them",
  async plan(db) {
    const writes: PlannedWrite[] = [];
    const report: string[] = [];
    const folders: FolderInfo[] = (await db.collection("fileFolders").get()).docs.map((d) => ({
      id: d.id,
      name: String(d.get("name") ?? ""),
      parentId: typeof d.get("parentId") === "string" ? d.get("parentId") : null,
      recordRef: readRef(d.get("recordRef")),
    }));
    const files = (await db.collection("weddingFiles").get()).docs.map((d) => ({
      url: String(d.get("url") ?? ""),
      recordRef: readRef(d.get("recordRef")),
    }));

    function folder(name: string, parentId: string | null, recordRef: RecordRef | null): string {
      const found = recordRef
        ? folders.find((f) => f.recordRef && sameRecord(f.recordRef, recordRef))
        : folders.find((f) => !f.recordRef && f.parentId === parentId && f.name === name);
      if (found) return found.id;
      const ref = db.collection("fileFolders").doc();
      folders.push({ id: ref.id, name, parentId, recordRef });
      writes.push({
        kind: "create",
        ref,
        data: { name, parentId, ...(recordRef ? { recordRef } : {}), ...created() },
        note: `folder "${name}"`,
      });
      return ref.id;
    }

    function file(f: { name: string; url: string }, ref: RecordRef, path: string[]) {
      if (files.some((x) => x.url === f.url && x.recordRef && sameRecord(x.recordRef, ref))) return;
      const root = folder(path[0], null, null);
      const recordFolder = folder(path[1], root, ref.partId ? { kind: ref.kind, id: ref.id } : ref);
      const folderId = ref.partId ? folder(path[2], recordFolder, ref) : recordFolder;
      const asset = cloudinaryAsset(f.url);
      const doc = db.collection("weddingFiles").doc();
      files.push({ url: f.url, recordRef: ref });
      writes.push({
        kind: "create",
        ref: doc,
        data: {
          name: f.name,
          category: "",
          description: "",
          folderId,
          url: f.url,
          publicId: asset?.publicId ?? "",
          resourceType: asset?.resourceType ?? "auto",
          originalFilename: f.name,
          fileType: "",
          fileSize: 0,
          uploadedBy: null,
          recordRef: ref,
          ...created(),
        },
        note: `file "${f.name}" → ${path.join(" › ")}`,
      });
    }

    const vendors = (await db.collection("vendors").get()).docs;
    const venues = (await db.collection("venues").get()).docs;
    const vendorUrls = new Map<string, Set<string>>();
    for (const v of vendors) vendorUrls.set(v.id, new Set(legacyFiles(v.get("files")).map((f) => f.url)));
    const vendorIdsByName = new Map<string, string[]>();
    for (const v of vendors) {
      const key = normalise(v.get("name"));
      vendorIdsByName.set(key, [...(vendorIdsByName.get(key) ?? []), v.id]);
    }

    for (const [kind, docs] of [["vendor", vendors], ["venue", venues]] as const) {
      for (const d of docs) {
        const data = d.data();
        const name = String(data.name ?? "");
        const ref: RecordRef = { kind, id: d.id };
        for (const f of legacyFiles(data.files)) file(f, ref, recordFolderPath(ref, name));
        for (const part of withIds(data.subEntries)) {
          const partRef: RecordRef = { kind: "booking", id: `${kind}-${d.id}`, partId: part.id };
          for (const f of legacyFiles(part.files)) file(f, partRef, recordFolderPath(partRef, name, String(part.name ?? "")));
        }
      }
    }

    for (const d of (await db.collection("shortlist").get()).docs) {
      const data = d.data();
      const name = String(data.name ?? "");
      // The old app copied vendor files onto finalists with the same name; those
      // show on the finalist through its vendor, so they aren't filed twice.
      const fromVendors = new Set<string>();
      const sources = [
        ...(typeof data.sourceVendorId === "string" ? [data.sourceVendorId] : []),
        ...(vendorIdsByName.get(normalise(name)) ?? []),
      ];
      for (const id of sources) for (const url of vendorUrls.get(id) ?? []) fromVendors.add(url);
      const ref: RecordRef = { kind: "finalist", id: d.id };
      let skipped = 0;
      for (const f of legacyFiles(data.files)) {
        if (fromVendors.has(f.url)) skipped++;
        else file(f, ref, recordFolderPath(ref, name));
      }
      if (skipped) report.push(`finalist "${name}": ${skipped} file(s) left out because they come from the vendor`);
      for (const pkg of withIds(data.subEntries)) {
        const pkgRef: RecordRef = { kind: "finalist", id: d.id, partId: pkg.id };
        for (const f of legacyFiles(pkg.files)) file(f, pkgRef, recordFolderPath(pkgRef, name, String(pkg.name ?? "")));
      }
    }

    const whatIf = (await db.collection("hypotheticalItems").get()).docs.reduce(
      (n, d) => n + legacyFiles(d.get("files")).length + withIds(d.get("subEntries")).reduce((m, p) => m + legacyFiles(p.files).length, 0),
      0,
    );
    if (whatIf) report.push(`${whatIf} file(s) on what-if items are not moved (what-if items have no files in the new design); they stay on the items`);
    report.push(`Top-level folders used: ${Object.values(RECORD_ROOT_FOLDER).join(", ")}`);
    return { writes, report };
  },
};

/* ---------- 6. started on ---------- */

/** The day in Jakarta, as YYYY-MM-DD. */
const jakartaDay = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);

const SKIP_FOR_START = new Set(["appMeta", "members", "activity", "presence", "pushSubscriptions", "funders", "guestMeta"]);

const startedOn: Migration = {
  name: "6-started-on",
  title: "Set `settings/wedding.startedOn` to the day the first record was made",
  async plan(db) {
    const settings = await db.doc("settings/wedding").get();
    if (settings.exists && typeof settings.get("startedOn") === "string") return { writes: [], report: [] };
    let earliest = Infinity;
    for (const col of await db.listCollections()) {
      if (SKIP_FOR_START.has(col.id)) continue;
      const first = await col.orderBy("createdAt", "asc").limit(1).get();
      const ms = (first.docs[0]?.get("createdAt") as Timestamp | undefined)?.toMillis?.();
      if (typeof ms === "number" && ms < earliest) earliest = ms;
    }
    if (!Number.isFinite(earliest)) return { writes: [], report: ["No record has a creation time yet; nothing set."] };
    const day = jakartaDay(earliest);
    return {
      writes: [{ kind: "merge", ref: settings.ref, data: { startedOn: day, ...migrated() }, note: `started on ${day}` }],
      report: [],
    };
  },
};

/* ---------- 7. items with several people (report only) ---------- */

const itemPeople: Migration = {
  name: "7-item-people-report",
  title: "Report wedding items that list more than one person (§9.2 Q4); writes nothing",
  async plan(db) {
    const items = (await db.collection("masterListItems").get()).docs.filter(
      (d) => Array.isArray(d.get("persons")) && (d.get("persons") as unknown[]).length > 1,
    );
    const report = items.length
      ? [
          `${items.length} item(s) list more than one person. Add a gap to §9.1 and a need to needs.md before Task 4.23:`,
          ...items.map((d) => `  "${d.get("item")}": ${(d.get("persons") as string[]).join(", ")}`),
        ]
      : ["No item lists more than one person. Task 4.23 can go ahead with one person per item."];
    return { writes: [], report };
  },
};

/* ---------- 8. old-UI edits since the migrations (review P1-S13) ---------- */

const VENDOR_BOOKED = new Set(["Chosen", "Done"]);

const isLiveMark = (raw: unknown): raw is Record<string, unknown> => isObject(raw) && raw.removed !== true;

/**
 * The old UI keeps writing until the switch-over reaches production, and it
 * doesn't know about `booking` or `agreedPrice`. Two of its edits leave the new
 * UI reading something else:
 * - a booked venue's price, which the old UI edits as `budgetEstimate` while
 *   the model reads `agreedPrice` first: the agreed price takes the edited one;
 * - a vendor moved off Chosen or Done, or a venue off Booked, which the old UI
 *   counts out of the budget while its `booking` still counts it in: the
 *   booking is marked removed, as the new UI's Remove booking does.
 * Direct bookings (Add a booking, a venue taken off the list) are left alone:
 * their stage isn't what makes them bookings. Run before the merge, while only
 * the old UI has written to production; afterwards the new UI's own stage and
 * price edits are deliberate and this would undo them.
 */
const oldUiSync: Migration = {
  name: "8-old-ui-sync",
  title: "Bring bookings in line with old-UI edits: venue prices and stages moved off booked (P1-S13)",
  async plan(db) {
    const writes: PlannedWrite[] = [];
    const report: string[] = [];
    const unbook = (snap: DocumentSnapshot, mark: Record<string, unknown>, label: string, stage: unknown) =>
      writes.push(update(snap, { booking: { ...mark, removed: true } }, `${label} is "${String(stage ?? "")}" now; booking removed`));
    for (const v of (await db.collection("vendors").get()).docs) {
      const data = v.data();
      if (!isLiveMark(data.booking) || data.booking.from === "direct") continue;
      if (!VENDOR_BOOKED.has(data.contractStatus)) unbook(v, data.booking, `vendor "${data.name ?? ""}"`, data.contractStatus);
    }
    for (const v of (await db.collection("venues").get()).docs) {
      const data = v.data();
      if (!isLiveMark(data.booking) || data.booking.from === "direct") continue;
      const label = `venue "${data.name ?? ""}"`;
      if (data.status !== "Booked") {
        unbook(v, data.booking, label, data.status);
        continue;
      }
      const edited = data.budgetEstimate;
      if (typeof edited !== "number" || edited === data.agreedPrice) continue;
      if (edited === 0) {
        report.push(`${label}: the old UI's price is blank and the agreed price is ${data.agreedPrice}; left as it is, check it by hand`);
        continue;
      }
      writes.push(update(v, { agreedPrice: edited }, `${label} agreed price ${data.agreedPrice ?? "none"} → ${edited} (edited in the old UI)`));
    }
    return { writes, report };
  },
};

export const MIGRATIONS: Migration[] = [
  funders,
  guestNumbers,
  bookings,
  finalistSources,
  legacyFilesMigration,
  startedOn,
  itemPeople,
  oldUiSync,
];
