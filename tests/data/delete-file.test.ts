import { existsSync, readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_EMULATOR, EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR, TEST_ACCOUNTS } from "../e2e/emulator-config";
import { clearFirestore, closeClient, makeClient, signIn, twoPartners, type Partner } from "./emulator";

/**
 * Delete for good (Task 6.3), through the real route handler and the real
 * client call, against the emulators. Cloudinary is a fake that checks every
 * request's signature; the last block talks to the real Cloudinary account
 * when its API key and secret are in `.env.local`, and is skipped otherwise.
 */
const CLOUD = "test-cloud";
const SECRET = "test-secret";

process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR;
process.env.FIREBASE_PROJECT_ID = EMULATOR_PROJECT_ID;

const { DELETE } = await import("@/app/api/files/[fileId]/route");
const { deleteFileForGood } = await import("@/lib/data/files");
const { sign } = await import("@/lib/server/cloudinary");
const { WriteError } = await import("@/lib/data/write-error");
const { connect } = await import("../../scripts/migrate/admin");
const { adminAuth: serverAuth } = await import("@/lib/server/firebase-admin");

const { db } = connect("delete-file-test");

/** Calls the route handler directly, the way Next would for this address. */
function routeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const path = String(input);
  const match = /^\/api\/files\/([^/]+)$/.exec(path);
  if (!match) throw new Error(`Unexpected request ${path}`);
  return DELETE(new Request(`http://localhost${path}`, init), {
    params: Promise.resolve({ fileId: decodeURIComponent(match[1]) }),
  } as RouteContext<"/api/files/[fileId]">);
}

/* ---------- a fake Cloudinary ---------- */

const realFetch = globalThis.fetch;
const fake = {
  on: true,
  assets: new Set<string>(),
  calls: [] as string[],
  failNext: 0,
};

async function fakeCloudinary(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const match = /^https:\/\/api\.cloudinary\.com\/v1_1\/([^/]+)\/(image|video|raw)\/destroy$/.exec(url);
  if (!fake.on || !match) return realFetch(input, init);
  const params = Object.fromEntries(new URLSearchParams(String(init?.body)));
  const { api_key, signature, ...signed } = params;
  if (match[1] !== CLOUD || api_key !== "test-key" || signature !== sign(signed, SECRET)) {
    return Response.json({ error: { message: "Invalid Signature" } }, { status: 401 });
  }
  const key = `${match[2]}/${params.public_id}`;
  fake.calls.push(key);
  if (fake.failNext > 0) {
    fake.failNext--;
    return Response.json({ error: { message: "Server busy" } }, { status: 500 });
  }
  return Response.json({ result: fake.assets.delete(key) ? "ok" : "not found" });
}

/* ---------- data ---------- */

const imageUrl = (id: string, version = 1) => `https://res.cloudinary.com/${CLOUD}/image/upload/v${version}/${id}.jpg`;
const rawUrl = (id: string) => `https://res.cloudinary.com/${CLOUD}/raw/upload/v1/${id}`;
const get = async (path: string) => (await db.doc(path).get()).data();

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
  process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = SECRET;
  fake.on = true;
  fake.assets = new Set();
  fake.calls = [];
  fake.failNext = 0;
  vi.stubGlobal("fetch", fakeCloudinary);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const del = (partner: Partner, fileId: string) => deleteFileForGood(fileId, { db: partner.db, fetch: routeFetch });

async function call(fileId: string, token?: string) {
  const res = await routeFetch(`/api/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, body: await res.json() };
}

describe("Delete for good", () => {
  it("destroys the asset, deletes the file and takes every old copy of its address off the records", async () => {
    const url = imageUrl("wedding/quote_ab12");
    const keep = { name: "Menu.pdf", url: rawUrl("wedding/menu.pdf") };
    fake.assets.add("image/wedding/quote_ab12");
    fake.assets.add("raw/wedding/menu.pdf");
    await db.doc("weddingFiles/f1").set({
      name: "Quote",
      url,
      publicId: "wedding/quote_ab12",
      resourceType: "image",
      folderId: "folder-1",
      recordRef: { kind: "vendor", id: "v1" },
    });
    await db.doc("weddingFiles/f2").set({ name: "Menu", url: keep.url, publicId: "wedding/menu.pdf", resourceType: "raw" });
    await db.doc("vendors/v1").set({
      name: "Kebun Bunga Atelier",
      files: [{ name: "Quote.jpg", url }, keep],
      subEntries: [
        { id: "p1", name: "Deposit", amount: 5, files: [{ name: "Quote again", url: imageUrl("wedding/quote_ab12", 2) }] },
        { name: "Balance", amount: 7, files: [keep] },
      ],
      notes: "unchanged",
    });
    await db.doc("shortlist/s1").set({ name: "Kebun", files: [{ name: "Quote.jpg", url }] });
    await db.doc("hypotheticalItems/w1").set({ name: "Band", files: [{ name: "Quote.jpg", url }] });
    await db.doc("venues/p1").set({ name: "Villa", files: [keep] });

    await del(gregory, "f1");

    expect(fake.calls).toEqual(["image/wedding/quote_ab12"]);
    expect(fake.assets.has("image/wedding/quote_ab12")).toBe(false);
    expect(fake.assets.has("raw/wedding/menu.pdf")).toBe(true);
    expect(await get("weddingFiles/f1")).toBeUndefined();
    expect(await get("weddingFiles/f2")).toBeDefined();
    const vendor = await get("vendors/v1");
    expect(vendor?.files).toEqual([keep]);
    expect(vendor?.subEntries).toEqual([
      { id: "p1", name: "Deposit", amount: 5, files: [] },
      { name: "Balance", amount: 7, files: [keep] },
    ]);
    expect(vendor?.notes).toBe("unchanged");
    expect(vendor?.updatedBy).toBe(gregory.uid);
    expect((await get("shortlist/s1"))?.files).toEqual([]);
    expect((await get("hypotheticalItems/w1"))?.files).toEqual([]);
    // A record that never had it isn't touched.
    expect((await get("venues/p1"))?.updatedBy).toBeUndefined();
  });

  it("is harmless the second time, and when the file is already gone", async () => {
    fake.assets.add("image/a");
    await db.doc("weddingFiles/f1").set({ name: "A", url: imageUrl("a"), publicId: "a", resourceType: "image" });
    await del(gregory, "f1");
    await del(bella, "f1");
    expect(fake.calls).toEqual(["image/a"]);
    expect(await call("f1", await bella.auth.currentUser!.getIdToken())).toEqual({ status: 200, body: { result: "already-gone" } });
    expect(await call("never-existed", await bella.auth.currentUser!.getIdToken())).toEqual({
      status: 200,
      body: { result: "already-gone" },
    });
  });

  it("still deletes the file when its asset is already gone from Cloudinary", async () => {
    await db.doc("weddingFiles/f1").set({ name: "A", url: imageUrl("a"), publicId: "a", resourceType: "image" });
    const res = await call("f1", await gregory.auth.currentUser!.getIdToken());
    expect(res).toEqual({ status: 200, body: { result: "deleted", asset: "already-gone", legacyCopiesRemoved: 0 } });
    expect(await get("weddingFiles/f1")).toBeUndefined();
  });

  it("works out an old file's asset from its address", async () => {
    fake.assets.add("raw/contract final.pdf");
    await db.doc("weddingFiles/old").set({
      name: "Contract",
      url: `https://res.cloudinary.com/${CLOUD}/raw/upload/v1/contract%20final.pdf`,
      publicId: "",
      resourceType: "auto",
    });
    await del(gregory, "old");
    expect(fake.calls).toEqual(["raw/contract final.pdf"]);
    expect(await get("weddingFiles/old")).toBeUndefined();
  });

  it("refuses, changing nothing, when the asset can't be worked out for certain", async () => {
    const token = await gregory.auth.currentUser!.getIdToken();
    const cases: Record<string, Record<string, unknown>> = {
      notCloudinary: { url: "https://example.com/x.pdf" },
      noUrl: { url: "", publicId: "a", resourceType: "image" },
      otherCloud: { url: "https://res.cloudinary.com/someone-else/image/upload/v1/a.jpg" },
      emptyId: { url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/.jpg` },
      privateAsset: { url: `https://res.cloudinary.com/${CLOUD}/image/authenticated/v1/a.jpg` },
      idMismatch: { url: imageUrl("a"), publicId: "b", resourceType: "image" },
      typeMismatch: { url: imageUrl("a"), publicId: "a", resourceType: "raw" },
    };
    for (const [id, data] of Object.entries(cases)) await db.doc(`weddingFiles/${id}`).set({ name: id, ...data });
    await db.doc("vendors/v1").set({ name: "V", files: [{ name: "x", url: "https://example.com/x.pdf" }] });

    for (const id of Object.keys(cases)) {
      const res = await call(id, token);
      expect(res.status, id).toBe(422);
      expect(res.body.error, id).toBe("unknown-asset");
      expect(await get(`weddingFiles/${id}`), id).toBeDefined();
    }
    expect(fake.calls).toEqual([]);
    expect((await get("vendors/v1"))?.files).toHaveLength(1);
  });

  it("leaves the file in place when Cloudinary fails, and a retry finishes the job", async () => {
    fake.assets.add("image/a");
    fake.failNext = 1;
    await db.doc("weddingFiles/f1").set({ name: "A", url: imageUrl("a"), publicId: "a", resourceType: "image" });
    await db.doc("vendors/v1").set({ name: "V", files: [{ name: "A", url: imageUrl("a") }] });

    const failure = await del(gregory, "f1").catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(WriteError);
    expect((failure as InstanceType<typeof WriteError>).code).toBe("failed");
    expect(await get("weddingFiles/f1")).toBeDefined();
    expect((await get("vendors/v1"))?.files).toHaveLength(1);

    await (failure as InstanceType<typeof WriteError>).retry!();
    expect(await get("weddingFiles/f1")).toBeUndefined();
    expect((await get("vendors/v1"))?.files).toEqual([]);
    expect(fake.assets.has("image/a")).toBe(false);
  });

  it("keeps an asset another file still uses, and takes it only off this file's own record", async () => {
    const url = imageUrl("shared");
    fake.assets.add("image/shared");
    await db.doc("weddingFiles/mine").set({
      name: "Mine",
      url,
      publicId: "shared",
      resourceType: "image",
      recordRef: { kind: "booking", id: "vendor-v1", partId: "p1" },
    });
    await db.doc("weddingFiles/theirs").set({
      name: "Theirs",
      url,
      publicId: "shared",
      resourceType: "image",
      recordRef: { kind: "finalist", id: "s1" },
    });
    await db.doc("vendors/v1").set({
      name: "V",
      files: [{ name: "Shared", url }],
      subEntries: [{ id: "p1", files: [{ name: "Shared", url }] }],
    });
    await db.doc("shortlist/s1").set({ name: "S", files: [{ name: "Shared", url }] });

    const res = await call("mine", await gregory.auth.currentUser!.getIdToken());
    expect(res).toEqual({ status: 200, body: { result: "deleted", asset: "kept", legacyCopiesRemoved: 1 } });
    expect(fake.calls).toEqual([]);
    expect(await get("weddingFiles/mine")).toBeUndefined();
    expect(await get("weddingFiles/theirs")).toBeDefined();
    const vendor = await get("vendors/v1");
    expect(vendor?.files).toEqual([{ name: "Shared", url }]);
    expect(vendor?.subEntries).toEqual([{ id: "p1", files: [] }]);
    expect((await get("shortlist/s1"))?.files).toEqual([{ name: "Shared", url }]);
  });

  it("only lets the two allowed, verified accounts delete", async () => {
    fake.assets.add("image/a");
    await db.doc("weddingFiles/f1").set({ name: "A", url: imageUrl("a"), publicId: "a", resourceType: "image" });

    expect((await call("f1")).status).toBe(401);
    expect((await call("f1", "not-a-token")).status).toBe(401);

    const adminAuth = serverAuth();
    const stranger = await adminAuth.createUser({ email: "stranger@example.com", password: "stranger-pw", emailVerified: true });
    const strangerClient = await signIn(makeClient(), { email: "stranger@example.com", password: "stranger-pw" });
    try {
      expect((await call("f1", await strangerClient.auth.currentUser!.getIdToken())).status).toBe(403);
      const refused = await del(strangerClient, "f1").catch((err: unknown) => err);
      expect((refused as InstanceType<typeof WriteError>).code).toBe("denied");
    } finally {
      await closeClient(strangerClient);
      await adminAuth.deleteUser(stranger.uid);
    }

    // An allowlisted address that isn't verified is refused too.
    const bellaUser = await adminAuth.getUserByEmail(TEST_ACCOUNTS[1].email);
    await adminAuth.updateUser(bellaUser.uid, { emailVerified: false });
    const unverified = await signIn(makeClient(), TEST_ACCOUNTS[1]);
    try {
      expect((await call("f1", await unverified.auth.currentUser!.getIdToken())).status).toBe(403);
    } finally {
      await closeClient(unverified);
      await adminAuth.updateUser(bellaUser.uid, { emailVerified: true });
    }

    expect(fake.calls).toEqual([]);
    expect(await get("weddingFiles/f1")).toBeDefined();
  });

  it("refuses an id that isn't a document id", async () => {
    const res = await call("a/b", await gregory.auth.currentUser!.getIdToken());
    expect(res.status).toBe(400);
  });

  it("says so, changing nothing, when the server has no Cloudinary keys", async () => {
    delete process.env.CLOUDINARY_API_SECRET;
    await db.doc("weddingFiles/f1").set({ name: "A", url: imageUrl("a"), publicId: "a", resourceType: "image" });
    const res = await call("f1", await gregory.auth.currentUser!.getIdToken());
    expect(res.status).toBe(503);
    expect(await get("weddingFiles/f1")).toBeDefined();
  });
});

/* ---------- the real Cloudinary account ---------- */

function realKeys(): { cloudName: string; apiKey: string; apiSecret: string } | null {
  const env: Record<string, string> = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = /^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
      if (m) env[m[1]] = m[2];
    }
  }
  const cloudName = process.env.CLOUDINARY_TEST_CLOUD_NAME ?? env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_TEST_API_KEY ?? env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_TEST_API_SECRET ?? env.CLOUDINARY_API_SECRET;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

const keys = realKeys();

describe.skipIf(!keys)("Delete for good on the real Cloudinary account (test folder only)", () => {
  it("removes an uploaded test asset and its file, and a second call is harmless", async () => {
    const { cloudName, apiKey, apiSecret } = keys!;
    fake.on = false;
    process.env.CLOUDINARY_CLOUD_NAME = cloudName;
    process.env.CLOUDINARY_API_KEY = apiKey;
    process.env.CLOUDINARY_API_SECRET = apiSecret;

    // Upload a small file into the test folder, signed.
    const params = {
      folder: "wedding-planning-tests",
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) form.set(k, v);
    form.set("api_key", apiKey);
    form.set("signature", sign(params, apiSecret));
    form.set("file", new Blob([`delete-for-good test ${Date.now()}`], { type: "text/plain" }), "test.txt");
    const uploadRes = await realFetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, { method: "POST", body: form });
    const upload = (await uploadRes.json()) as { public_id: string; secure_url: string; resource_type: string };
    expect(uploadRes.status, JSON.stringify(upload)).toBe(200);
    expect(upload.public_id.startsWith("wedding-planning-tests/")).toBe(true);

    const exists = async () => {
      const res = await realFetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/raw/upload/${upload.public_id
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`,
        { headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}` } },
      );
      return res.status === 200;
    };
    expect(await exists()).toBe(true);

    await db.doc("weddingFiles/real").set({
      name: "test.txt",
      url: upload.secure_url,
      publicId: upload.public_id,
      resourceType: upload.resource_type,
    });
    const first = await call("real", await gregory.auth.currentUser!.getIdToken());
    expect(first).toEqual({ status: 200, body: { result: "deleted", asset: "destroyed", legacyCopiesRemoved: 0 } });
    expect(await get("weddingFiles/real")).toBeUndefined();
    expect(await exists()).toBe(false);

    const second = await call("real", await gregory.auth.currentUser!.getIdToken());
    expect(second).toEqual({ status: 200, body: { result: "already-gone" } });
  });
});
