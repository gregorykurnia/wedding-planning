import { beforeEach, describe, expect, it } from "vitest";
import { FIRESTORE_EMULATOR } from "../e2e/emulator-config";
import { clearFirestore } from "./emulator";

// The Admin SDK talks to the emulator when this is set, with no credentials.
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR;
const { connect } = await import("../../scripts/migrate/admin");
const { run } = await import("../../scripts/migrate/run");
const { check } = await import("../../scripts/migrate/checks");
const { contentFields } = await import("../../src/lib/data/adapters/documents");

const { db } = connect("switch-checks-test");
const quiet = () => {};
const get = async (path: string) => (await db.doc(path).get()).data();
const booking = (from: string) => ({ on: null, from, removed: false });

beforeEach(async () => {
  await clearFirestore();
});

describe("8-old-ui-sync (review P1-S13)", () => {
  beforeEach(async () => {
    const w = db.batch();
    // Booked venues: price edited in the old UI, untouched, blanked, and moved off Booked.
    w.set(db.doc("venues/edited"), { name: "Villa", status: "Booked", budgetEstimate: 350, agreedPrice: 300, booking: booking("venue") });
    w.set(db.doc("venues/same"), { name: "Lawn", status: "Booked", budgetEstimate: 100, agreedPrice: 100, booking: booking("venue") });
    w.set(db.doc("venues/blank"), { name: "Hall", status: "Booked", budgetEstimate: 0, agreedPrice: 80, booking: booking("venue") });
    w.set(db.doc("venues/moved"), { name: "Barn", status: "Toured", budgetEstimate: 50, agreedPrice: 50, booking: booking("venue") });
    // Vendors: moved off Chosen, still Done, direct (left alone), already removed.
    w.set(db.doc("vendors/moved"), { name: "Florist", contractStatus: "Inquiring", booking: { on: "2026-05-01", from: "vendor", removed: false } });
    w.set(db.doc("vendors/done"), { name: "Cake", contractStatus: "Done", booking: booking("vendor") });
    w.set(db.doc("vendors/direct"), { name: "Band", contractStatus: "List", booking: booking("direct") });
    w.set(db.doc("vendors/removed"), { name: "DJ", contractStatus: "List", booking: { on: null, from: "vendor", removed: true } });
    await w.commit();
  });

  it("a dry run lists the changes and writes nothing", async () => {
    const lines: string[] = [];
    const [result] = await run(["8-old-ui-sync"], false, (l) => lines.push(l));
    expect(result.planned).toBe(3);
    expect(lines.join("\n")).toMatch(/venue "Villa" agreed price 300 → 350/);
    expect(result.report.join("\n")).toMatch(/venue "Hall": the old UI's price is blank/);
    expect((await get("venues/edited"))?.agreedPrice).toBe(300);
    expect((await get("vendors/moved"))?.booking.removed).toBe(false);
  });

  it("applies them, keeping each booking's day and source, and plans nothing the second time", async () => {
    await run(["8-old-ui-sync"], true, quiet);
    expect(await get("venues/edited")).toMatchObject({ agreedPrice: 350, budgetEstimate: 350, updatedBy: "migration" });
    expect((await get("venues/same"))?.updatedBy).toBeUndefined();
    expect((await get("venues/blank"))?.agreedPrice).toBe(80);
    const by = { removedBy: "8-old-ui-sync" };
    expect((await get("venues/moved"))?.booking).toEqual({ on: null, from: "venue", removed: true, ...by });
    expect((await get("vendors/moved"))?.booking).toEqual({ on: "2026-05-01", from: "vendor", removed: true, ...by });
    expect((await get("vendors/done"))?.booking.removed).toBe(false);
    expect((await get("vendors/direct"))?.booking.removed).toBe(false);
    const [again] = await run(["8-old-ui-sync"], false, quiet);
    expect(again.planned).toBe(0);
  });

  // Phase 7 review: a local preview against production writes through the new UI.
  it("only reports records the new UI has written", async () => {
    await db.doc("venues/edited").update({ updatedBy: "uid-greg" });
    await db.doc("vendors/moved").update({ updatedBy: "uid-bella" });
    const [result] = await run(["8-old-ui-sync"], true, quiet, true);
    expect(result.planned).toBe(1);
    expect(result.report.join("\n")).toMatch(/venue "Villa" agreed price 300 → 350.*left alone/);
    expect(result.report.join("\n")).toMatch(/vendor "Florist".*left alone/);
    expect((await get("venues/edited"))?.agreedPrice).toBe(300);
    expect((await get("vendors/moved"))?.booking.removed).toBe(false);
  });

  // Phase 7 review S11: bookings made from a finalist, and a booked venue whose price comes from its parts.
  it("treats a finalist's booking as a vendor's, and only reports a venue with parts", async () => {
    const w = db.batch();
    w.set(db.doc("vendors/fromFinalist"), { name: "Atelier", contractStatus: "Chosen", booking: booking("finalist") });
    w.set(db.doc("vendors/finalistMoved"), { name: "Studio", contractStatus: "Inquiring", booking: booking("finalist") });
    w.set(db.doc("venues/parts"), {
      name: "Garden",
      status: "Booked",
      budgetEstimate: 500,
      agreedPrice: 0,
      booking: booking("venue"),
      subEntries: [
        { id: "p1", name: "Deposit", totalPrice: 100 },
        { id: "p2", name: "Balance", totalPrice: 300 },
      ],
    });
    await w.commit();
    const [result] = await run(["8-old-ui-sync"], true, quiet);
    expect((await get("vendors/fromFinalist"))?.booking.removed).toBe(false);
    expect((await get("vendors/finalistMoved"))?.booking).toMatchObject({ from: "finalist", removed: true });
    expect((await get("venues/parts"))?.agreedPrice).toBe(0);
    expect(result.report.join("\n")).toMatch(/venue "Garden": .*parts.*left as it is/);
  });

  it("puts back a booking it removed once the old UI books it again", async () => {
    await run(["8-old-ui-sync"], true, quiet);
    await db.doc("vendors/moved").update({ contractStatus: "Chosen" });
    await db.doc("vendors/removed").update({ contractStatus: "Chosen" });
    const [result] = await run(["8-old-ui-sync"], true, quiet, true);
    expect(result.planned).toBe(1);
    expect((await get("vendors/moved"))?.booking).toEqual({ on: "2026-05-01", from: "vendor", removed: false });
    // One the new UI removed stays removed.
    expect((await get("vendors/removed"))?.booking.removed).toBe(true);
  });
});

describe("read-only checks", () => {
  it("finds addresses filed twice (review P1-S15)", async () => {
    const w = db.batch();
    w.set(db.doc("weddingFiles/a"), { name: "Package.pdf", url: "https://x/pkg.pdf", recordRef: { kind: "finalist", id: "s1", partId: "k1" } });
    w.set(db.doc("weddingFiles/b"), { name: "Package.pdf", url: "https://x/pkg.pdf", recordRef: { kind: "booking", id: "vendor-v1", partId: "p1" } });
    w.set(db.doc("weddingFiles/c"), { name: "Quote.pdf", url: "https://x/quote.pdf" });
    await w.commit();
    const [files] = await check(["files"], quiet);
    expect(files.found).toBe(1);
    expect(files.report.join("\n")).toMatch(/2× https:\/\/x\/pkg\.pdf[\s\S]*finalist s1 › k1[\s\S]*booking vendor-v1 › p1/);
    expect(files.report.join("\n")).not.toMatch(/quote/);
  });

  it("finds documents the editor's content check refuses (review P5-S8)", async () => {
    const w = db.batch();
    w.set(db.doc("notes/fine"), { title: "Seating", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }] } });
    w.set(db.doc("notes/plain"), { title: "Old note", text: "line one\nline two" });
    w.set(db.doc("notes/broken"), { title: "Vows", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "paragraph" }] }] } });
    await w.commit();
    const [documents] = await check(["documents"], quiet);
    expect(documents.found).toBe(1);
    expect(documents.report).toEqual([expect.stringMatching(/^broken {2}"Vows": Invalid content for node paragraph/)]);
  });

  // Phase 7 review S11: the shapes most likely to be refused.
  it("checks documents stored whole in contentJson, and ones with nodes or marks the editor lacks", async () => {
    const nested = (inner: object[], depth: number): object =>
      depth === 0 ? { type: "doc", content: inner } : nested([{ type: "blockquote", content: inner }], depth - 1);
    const text = [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }];
    const deepFine = nested(text, 30);
    const deepBroken = nested([{ type: "paragraph", content: [{ type: "paragraph" }] }], 30);
    expect(contentFields(deepFine, null)).toHaveProperty("contentJson", expect.any(String));
    const w = db.batch();
    w.set(db.doc("notes/deepFine"), { title: "Deep", ...contentFields(deepFine, null) });
    w.set(db.doc("notes/deepBroken"), { title: "Deeper", ...contentFields(deepBroken, null) });
    w.set(db.doc("notes/image"), { title: "Moodboard", content: { type: "doc", content: [{ type: "image", attrs: { src: "https://x/a.png" } }] } });
    w.set(db.doc("notes/highlight"), {
      title: "Menu",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hi", marks: [{ type: "highlight" }] }] }] },
    });
    await w.commit();
    const [documents] = await check(["documents"], quiet);
    expect(documents.found).toBe(3);
    const report = documents.report.join("\n");
    expect(report).toMatch(/^deepBroken {2}"Deeper": Invalid content for node paragraph/m);
    expect(report).toMatch(/^image {2}"Moodboard": .*image/m);
    expect(report).toMatch(/^highlight {2}"Menu": .*highlight/m);
    expect(report).not.toMatch(/deepFine/);
  });

  it("passes on clean data, writes nothing, and refuses an unknown check", async () => {
    const results = await check([], quiet);
    expect(results.map((r) => [r.name, r.found])).toEqual([["files", 0], ["documents", 0]]);
    expect((await db.listCollections()).length).toBe(0);
    await expect(check(["nope"], quiet)).rejects.toThrow("Unknown check: nope");
  });
});
