import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { FIRESTORE_EMULATOR } from "../e2e/emulator-config";
import { clearFirestore } from "./emulator";

// The Admin SDK talks to the emulator when this is set, with no credentials.
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR;
const { connect } = await import("../../scripts/migrate/admin");
const { run } = await import("../../scripts/migrate/run");
const { MIGRATIONS } = await import("../../scripts/migrate/migrations");

const { db } = connect("migrate-test");
const quiet = () => {};
const ts = (iso: string) => Timestamp.fromDate(new Date(iso));

async function seedLegacy() {
  const w = db.batch();
  w.set(db.doc("vendors/v1"), {
    name: "Kebun Bunga Atelier",
    contractStatus: "Chosen",
    priceOptions: [
      { id: "o1", price: 10, selected: false },
      { id: "o2", price: 12, selected: true },
    ],
    files: [{ name: "Quote.pdf", url: "https://res.cloudinary.com/x/raw/upload/v1/quote.pdf" }],
    subEntries: [
      { id: "p1", name: "Deposit", files: [{ name: "Receipt.jpg", url: "https://res.cloudinary.com/x/image/upload/v2/r.jpg" }] },
      { name: "Balance", files: [{ name: "Old.pdf", url: "https://x/old.pdf" }] },
    ],
    createdAt: ts("2025-11-03T20:00:00Z"),
  });
  w.set(db.doc("vendors/v2"), { name: "Dapur Lestari", contractStatus: "Inquiring", createdAt: ts("2025-12-01T00:00:00Z") });
  w.set(db.doc("vendors/v3"), { name: "Twin", contractStatus: "Done", priceOptions: [], createdAt: ts("2026-01-01T00:00:00Z") });
  w.set(db.doc("vendors/v4"), { name: "twin ", contractStatus: "List", createdAt: ts("2026-01-02T00:00:00Z") });
  w.set(db.doc("venues/p1"), { name: "Villa Samaya", status: "Booked", budgetEstimate: 300, files: [], createdAt: ts("2026-01-01T00:00:00Z") });
  w.set(db.doc("venues/p2"), { name: "Lawn", status: "Toured", budgetEstimate: 100, createdAt: ts("2026-01-01T00:00:00Z") });
  w.set(db.doc("shortlist/s1"), {
    name: "kebun bunga  atelier",
    files: [
      { name: "Quote.pdf", url: "https://res.cloudinary.com/x/raw/upload/v1/quote.pdf" },
      { name: "Moodboard.png", url: "https://res.cloudinary.com/x/image/upload/v3/mood.png" },
    ],
    subEntries: [{ id: "k1", name: "Full day", files: [{ name: "Package.pdf", url: "https://x/pkg.pdf" }] }],
    createdAt: ts("2026-02-01T00:00:00Z"),
  });
  w.set(db.doc("shortlist/s2"), { name: "Twin", createdAt: ts("2026-02-01T00:00:00Z") });
  w.set(db.doc("shortlist/s3"), { name: "Arka", createdAt: ts("2026-02-01T00:00:00Z") });
  w.set(db.doc("guests/g1"), { name: "B", createdAt: ts("2026-03-02T00:00:00Z") });
  w.set(db.doc("guests/g2"), { name: "A", createdAt: ts("2026-03-01T00:00:00Z") });
  w.set(db.doc("guests/g3"), { name: "C" });
  w.set(db.doc("hypotheticalItems/w1"), { name: "Band", files: [{ name: "x", url: "https://x/w.pdf" }] });
  w.set(db.doc("masterListItems/m1"), { item: "Suits", persons: ["Groom", "Groom Dad"] });
  w.set(db.doc("masterListItems/m2"), { item: "Dress", persons: ["Bride"] });
  w.set(db.doc("settings/wedding"), { weddingDate: "2026-12-12" });
  await w.commit();
}

const get = async (path: string) => (await db.doc(path).get()).data();

beforeAll(async () => {
  await clearFirestore();
});

beforeEach(async () => {
  await clearFirestore();
  await seedLegacy();
});

describe("migrations", () => {
  it("a dry run plans every change and writes nothing", async () => {
    const results = await run(["all"], false, quiet);
    expect(results.map((r) => [r.name, r.planned])).toEqual([
      ["1-funders", 4],
      ["2-guest-numbers", 4],
      ["3-bookings", 3],
      ["4-finalist-sources", 1],
      // Root folders Vendors, Bookings, Shortlist; record folders; part folders; 5 files.
      ["5-legacy-files", expect.any(Number)],
      ["6-started-on", 1],
      ["7-item-people-report", 0],
    ]);
    expect((await db.collection("funders").get()).size).toBe(0);
    expect(await get("vendors/v1")).not.toHaveProperty("booking");
    expect((await db.doc("appMeta/migrations").get()).exists).toBe(false);
  });

  it("applies each migration, records the runs, and plans nothing the second time", async () => {
    const results = await run(["all"], true, quiet);

    // 1. funders
    const funders = (await db.collection("funders").orderBy("order").get()).docs.map((d) => [d.id, d.get("name")]);
    expect(funders).toEqual([["CK", "CK"], ["Gregory", "Gregory"], ["Bella", "Bella"], ["Bella Fam", "Bella Fam"]]);

    // 2. guest numbers in creation order, undated last; counter after them
    expect([(await get("guests/g2"))?.number, (await get("guests/g1"))?.number, (await get("guests/g3"))?.number]).toEqual([1, 2, 3]);
    expect((await get("guestMeta/counter"))?.next).toBe(4);

    // 3. bookings
    expect(await get("vendors/v1")).toMatchObject({ booking: { on: null, from: "vendor", removed: false }, estimate: 12 });
    expect(await get("vendors/v3")).toMatchObject({ booking: { on: null, from: "vendor", removed: false }, estimate: null });
    expect(await get("vendors/v2")).not.toHaveProperty("booking");
    expect(await get("venues/p1")).toMatchObject({ booking: { from: "venue" }, agreedPrice: 300 });
    expect(await get("venues/p2")).not.toHaveProperty("booking");

    // 4. finalist sources: exact normalised name; ambiguous ones reported, not linked
    expect((await get("shortlist/s1"))?.sourceVendorId).toBe("v1");
    expect(await get("shortlist/s2")).not.toHaveProperty("sourceVendorId");
    expect(results.find((r) => r.name === "4-finalist-sources")?.report.join("\n")).toMatch(/AMBIGUOUS: finalist "Twin"/);

    // 5. legacy files: in Files, in folders named after the record; vendor copies on the finalist left out
    const files = (await db.collection("weddingFiles").get()).docs.map((d) => d.data());
    expect(files.map((f) => f.name).sort()).toEqual(["Moodboard.png", "Old.pdf", "Package.pdf", "Quote.pdf", "Receipt.jpg"]);
    const receipt = files.find((f) => f.name === "Receipt.jpg")!;
    expect(receipt).toMatchObject({
      recordRef: { kind: "booking", id: "vendor-v1", partId: "p1" },
      publicId: "r",
      resourceType: "image",
      createdBy: "migration",
    });
    expect(files.find((f) => f.name === "Old.pdf")?.recordRef).toEqual({ kind: "booking", id: "vendor-v1", partId: "legacy-1" });
    expect(files.find((f) => f.name === "Package.pdf")?.recordRef).toEqual({ kind: "finalist", id: "s1", partId: "k1" });
    const folders = (await db.collection("fileFolders").get()).docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown> & { id: string });
    const path = (id: unknown): string[] => {
      const f = folders.find((x) => x.id === id)!;
      return f.parentId ? [...path(f.parentId), String(f.name)] : [String(f.name)];
    };
    expect(path(receipt.folderId)).toEqual(["Bookings", "Kebun Bunga Atelier", "Deposit"]);
    expect(path(files.find((f) => f.name === "Quote.pdf")!.folderId)).toEqual(["Vendors", "Kebun Bunga Atelier"]);
    expect(path(files.find((f) => f.name === "Moodboard.png")!.folderId)).toEqual(["Shortlist", "kebun bunga  atelier"]);
    // Legacy arrays stay for the old UI.
    expect((await get("vendors/v1"))?.files).toHaveLength(1);
    expect(results.find((r) => r.name === "5-legacy-files")?.report.join("\n")).toMatch(/1 file\(s\) on what-if items/);

    // 6. started on: the first record's day in Jakarta (03:00 on 4 November there)
    expect((await get("settings/wedding"))?.startedOn).toBe("2025-11-04");
    expect((await get("settings/wedding"))?.weddingDate).toBe("2026-12-12");

    // 7. report only
    expect(results.find((r) => r.name === "7-item-people-report")?.report.join("\n")).toMatch(/"Suits": Groom, Groom Dad/);

    // Every run is recorded.
    const meta = await get("appMeta/migrations");
    expect(meta?.runs.map((r: { name: string }) => r.name)).toEqual(MIGRATIONS.map((m) => m.name));
    expect(meta?.["3-bookings"]).toMatchObject({ written: 3 });

    // Idempotent: a second run plans nothing.
    const again = await run(["all"], false, quiet);
    expect(again.map((r) => r.planned)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("refuses to apply a migration already recorded, unless forced (review P1-S14)", async () => {
    await run(["1-funders"], true, quiet);
    await db.doc("funders/Bella Fam").delete();
    await expect(run(["all"], true, quiet)).rejects.toThrow("Already run: 1-funders. Add --force to run again.");
    // Nothing was written: the deleted funder stays deleted and no other migration ran.
    expect(await get("funders/Bella Fam")).toBeUndefined();
    expect((await get("appMeta/migrations"))?.runs).toHaveLength(1);
    // A dry run still works, and --force runs it again.
    await run(["1-funders"], false, quiet);
    const [forced] = await run(["1-funders"], true, quiet, true);
    expect(forced.written).toBeGreaterThan(0);
  });

  it("refuses to overwrite a record changed after the plan", async () => {
    const { applyPlan } = await import("../../scripts/migrate/plan");
    const bookings = MIGRATIONS.find((m) => m.name === "3-bookings")!;
    const plan = await bookings.plan(db);
    await db.doc("vendors/v1").update({ notes: "Bella's edit" });
    await expect(applyPlan(db, plan)).rejects.toThrow();
    expect(await get("vendors/v1")).not.toHaveProperty("booking");
    expect((await get("vendors/v1"))?.notes).toBe("Bella's edit");
  });

  it("runs one migration by name", async () => {
    const [only] = await run(["1-funders"], true, quiet);
    expect(only).toMatchObject({ name: "1-funders", written: 4 });
    expect(await get("vendors/v1")).not.toHaveProperty("booking");
  });
});
