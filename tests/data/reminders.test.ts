import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_EMULATOR, EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR } from "../e2e/emulator-config";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

/**
 * Push reminders (Task 6.2) against the emulators: the daily run with a fake
 * sender, and both route handlers with `web-push` replaced by a fake that
 * records what it was asked to send.
 */
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR;
process.env.FIREBASE_PROJECT_ID = EMULATOR_PROJECT_ID;

const pushes = vi.hoisted(() => ({
  sent: [] as { endpoint: string; payload: string }[],
  status: new Map<string, number>(),
}));
vi.mock("web-push", () => ({
  default: {
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      const status = pushes.status.get(sub.endpoint);
      if (status) throw Object.assign(new Error(`Push service answered ${status}`), { statusCode: status });
      pushes.sent.push({ endpoint: sub.endpoint, payload });
      return { statusCode: 201 };
    },
  },
}));

const { runReminders } = await import("@/lib/server/reminders");
const { GET: cron } = await import("@/app/api/cron/reminders/route");
const { POST: test } = await import("@/app/api/push/test/route");
const { subscriptionId } = await import("@/lib/model/push");
const { savePushSubscription } = await import("@/lib/collections/push-subscriptions");
const { connect } = await import("../../scripts/migrate/admin");
type SendPush = import("@/lib/server/push").SendPush;
type SendResult = import("@/lib/server/push").SendResult;

const { db } = connect("reminders-test");

// 00:10 UTC on Thursday 15 October 2026: 07:10 in Jakarta, the daily run.
const RUN = new Date("2026-10-15T00:10:00Z");

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
  pushes.sent = [];
  pushes.status = new Map();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public";
  process.env.VAPID_PRIVATE_KEY = "test-private";
  process.env.CRON_SECRET = "cron-secret";
});

const endpoint = (name: string) => `https://push.example.com/${name}`;

async function device(name: string, uid: string) {
  await db.doc(`pushSubscriptions/${subscriptionId(endpoint(name))}`).set({
    uid,
    endpoint: endpoint(name),
    keys: { p256dh: `p-${name}`, auth: `a-${name}` },
    device: name,
  });
}

async function eventDoc(id: string, over: Record<string, unknown> = {}) {
  await db.doc(`scheduleEvents/${id}`).set({
    title: "Tasting at Sendok Emas",
    type: "appointment",
    startAt: "2026-10-16T11:00",
    endAt: null,
    allDay: false,
    notes: "",
    location: "Sendok Emas, Kemang",
    status: "scheduled",
    relatedVendorId: null,
    relatedVenueId: null,
    reminderMinutes: [1440],
    remindersSent: [],
    ...over,
  });
}

/** A sender that records each push and answers from `answers` (by device name), `sent` otherwise. */
function fakeSender(answers: Record<string, SendResult> = {}) {
  const calls: { device: string; payload: Record<string, string> }[] = [];
  const send: SendPush = async (sub, payload) => {
    const name = sub.endpoint.split("/").pop()!;
    calls.push({ device: name, payload: JSON.parse(payload) });
    return answers[name] ?? "sent";
  };
  return { calls, send };
}

const sentOf = async (id: string) => (await db.doc(`scheduleEvents/${id}`).get()).get("remindersSent");

describe("the daily run", () => {
  it("sends a due reminder to every device once, records it, and a second run sends nothing", async () => {
    await device("greg-mac", gregory.uid);
    await device("bella-iphone", bella.uid);
    await eventDoc("tasting");
    await eventDoc("later", { title: "Fitting", startAt: "2026-10-20T10:00" });

    const first = fakeSender();
    const summary = await runReminders(db, first.send, RUN);
    expect(summary).toMatchObject({ today: "2026-10-15", due: 1, sent: 1, retry: 0, devices: 2, removedDevices: 0 });
    expect(first.calls.map((c) => c.device).sort()).toEqual(["bella-iphone", "greg-mac"]);
    expect(first.calls[0].payload).toEqual({
      title: "Tasting at Sendok Emas",
      body: "Tomorrow, Friday 16 October, 11:00\nSendok Emas, Kemang",
      url: "/schedule?event=tasting",
      tag: "reminder-tasting-1440",
    });
    expect(await sentOf("tasting")).toEqual([1440]);

    const second = fakeSender();
    expect(await runReminders(db, second.send, new Date("2026-10-15T03:00:00Z"))).toMatchObject({ due: 0, sent: 0 });
    expect(second.calls).toEqual([]);
  });

  it("sends each reminder once when two runs overlap", async () => {
    await device("greg-mac", gregory.uid);
    await eventDoc("tasting");
    await eventDoc("fitting", { title: "Fitting", startAt: "2026-10-22", allDay: true, reminderMinutes: [10080] });
    const a = fakeSender();
    const b = fakeSender();
    await Promise.all([runReminders(db, a.send, RUN), runReminders(db, b.send, RUN)]);
    const tags = [...a.calls, ...b.calls].map((c) => c.payload.tag).sort();
    expect(tags).toEqual(["reminder-fitting-10080", "reminder-tasting-1440"]);
  });

  it("removes a device the push service has forgotten, and still records the reminder for the others", async () => {
    await device("greg-mac", gregory.uid);
    await device("old-phone", bella.uid);
    await eventDoc("tasting");
    const run = fakeSender({ "old-phone": "gone" });
    expect(await runReminders(db, run.send, RUN)).toMatchObject({ sent: 1, removedDevices: 1 });
    expect((await db.doc(`pushSubscriptions/${subscriptionId(endpoint("old-phone"))}`).get()).exists).toBe(false);
    expect((await db.doc(`pushSubscriptions/${subscriptionId(endpoint("greg-mac"))}`).get()).exists).toBe(true);
    expect(await sentOf("tasting")).toEqual([1440]);
  });

  it("gives a reminder back when no device took it, and the next morning's run sends it", async () => {
    await device("greg-mac", gregory.uid);
    await eventDoc("tasting", { startAt: "2026-10-16T15:00" });
    expect(await runReminders(db, fakeSender({ "greg-mac": "failed" }).send, RUN)).toMatchObject({ sent: 0, retry: 1 });
    expect(await sentOf("tasting")).toEqual([]);
    const next = fakeSender();
    await runReminders(db, next.send, new Date("2026-10-16T00:10:00Z"));
    expect(next.calls.map((c) => c.payload.body)).toEqual(["Today, Friday 16 October, 15:00\nSendok Emas, Kemang"]);
    expect(await sentOf("tasting")).toEqual([1440]);
  });

  it("gives a reminder back when every device turned out forgotten, so a device saved again gets it the next morning (Phase 6 review)", async () => {
    await device("old-phone", bella.uid);
    await eventDoc("tasting", { startAt: "2026-10-16T15:00" });
    await eventDoc("fitting", { title: "Fitting", startAt: "2026-10-22", allDay: true, reminderMinutes: [10080] });
    expect(await runReminders(db, fakeSender({ "old-phone": "gone" }).send, RUN)).toMatchObject({ sent: 0, removedDevices: 1 });
    expect(await sentOf("tasting")).toEqual([]);
    expect(await sentOf("fitting")).toEqual([]);
    await device("new-phone", bella.uid);
    const next = fakeSender();
    await runReminders(db, next.send, new Date("2026-10-16T00:10:00Z"));
    expect(next.calls.map((c) => c.payload.tag).sort()).toEqual(["reminder-fitting-10080", "reminder-tasting-1440"]);
  });

  it("sends nothing for reminders set for a time of day, finished or cancelled events, and claims nothing with no devices", async () => {
    await device("greg-mac", gregory.uid);
    await eventDoc("hour", { startAt: "2026-10-15T11:00", reminderMinutes: [60] });
    await eventDoc("done", { status: "completed" });
    await eventDoc("off", { status: "cancelled" });
    const run = fakeSender();
    expect(await runReminders(db, run.send, RUN)).toMatchObject({ due: 0 });
    expect(run.calls).toEqual([]);

    await db.doc(`pushSubscriptions/${subscriptionId(endpoint("greg-mac"))}`).delete();
    await eventDoc("tasting");
    expect(await runReminders(db, run.send, RUN)).toMatchObject({ due: 1, sent: 0, devices: 0 });
    expect(await sentOf("tasting")).toEqual([]);
  });
});

describe("GET /api/cron/reminders", () => {
  const call = (auth?: string) =>
    cron(new Request("http://localhost/api/cron/reminders", { headers: auth ? { Authorization: auth } : {} }));

  it("refuses without the cron secret, and everyone when none is set", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await call("Bearer ")).status).toBe(503);
    expect((await call("Bearer undefined")).status).toBe(503);
  });

  it("runs with the secret and sends with web push", async () => {
    vi.useFakeTimers({ now: RUN, toFake: ["Date"] });
    try {
      await device("greg-mac", gregory.uid);
      await eventDoc("tasting");
      const res = await call("Bearer cron-secret");
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ due: 1, sent: 1 });
      expect(pushes.sent.map((p) => [p.endpoint, JSON.parse(p.payload).tag])).toEqual([[endpoint("greg-mac"), "reminder-tasting-1440"]]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("says when the push keys aren't set", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const res = await call("Bearer cron-secret");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "not-configured" });
  });
});

describe("POST /api/push/test", () => {
  const call = async (partner: Partner | null, body: unknown) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (partner) headers.Authorization = `Bearer ${await partner.auth.currentUser!.getIdToken()}`;
    const res = await test(new Request("http://localhost/api/push/test", { method: "POST", headers, body: JSON.stringify(body) }));
    return { status: res.status, body: await res.json() };
  };

  it("sends a test to the caller's own device, saved the way the browser saves it", async () => {
    await savePushSubscription({ endpoint: endpoint("greg-mac"), keys: { p256dh: "p", auth: "a" } }, "Mac", gregory.db);
    expect(await call(gregory, { endpoint: endpoint("greg-mac") })).toEqual({ status: 200, body: { result: "sent" } });
    expect(pushes.sent).toHaveLength(1);
    expect(JSON.parse(pushes.sent[0].payload)).toMatchObject({ title: "Test reminder", url: "/settings", tag: "test-reminder" });
  });

  it("refuses without sign-in, for another account's device, and for a device that isn't saved", async () => {
    await device("bella-iphone", bella.uid);
    expect((await call(null, { endpoint: endpoint("bella-iphone") })).status).toBe(401);
    expect((await call(gregory, { endpoint: endpoint("bella-iphone") })).body).toMatchObject({ error: "not-subscribed" });
    expect((await call(gregory, { endpoint: endpoint("nothing") })).status).toBe(404);
    expect((await call(gregory, { endpoint: "http://localhost:8080/admin" })).status).toBe(400);
    expect(pushes.sent).toEqual([]);
  });

  it("removes a device the push service has forgotten", async () => {
    await device("greg-mac", gregory.uid);
    pushes.status.set(endpoint("greg-mac"), 410);
    expect((await call(gregory, { endpoint: endpoint("greg-mac") })).body).toMatchObject({ error: "not-subscribed" });
    expect((await db.doc(`pushSubscriptions/${subscriptionId(endpoint("greg-mac"))}`).get()).exists).toBe(false);
  });
});
