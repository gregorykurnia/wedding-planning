import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { EMULATOR_PROJECT_ID, FIRESTORE_EMULATOR } from "../e2e/emulator-config";

/**
 * Any signed-in account, anonymous ones included, can read and write every
 * shared collection; nobody signed in can't. Open access since 2026-10-22;
 * before, only the two allowlisted, verified accounts could (Task 1.9).
 */

const [host, port] = FIRESTORE_EMULATOR.split(":");
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: EMULATOR_PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// One context each, made once: every context is its own Firestore client.
const contexts = new Map<string, RulesTestContext>();
const context = (key: string, make: () => RulesTestContext) => () => {
  if (!contexts.has(key)) contexts.set(key, make());
  return contexts.get(key)!;
};
const gregory = context("gregory", () =>
  env.authenticatedContext("uid-gregory", { email: "gregory.kurnia@gmail.com", email_verified: true }),
);
const bella = context("bella", () =>
  env.authenticatedContext("uid-bella", { email: "bellabarliana15@gmail.com", email_verified: true }),
);
const stranger = context("stranger", () =>
  env.authenticatedContext("uid-stranger", { email: "someone@example.com", email_verified: true }),
);
const unverified = context("unverified", () =>
  env.authenticatedContext("uid-unverified", { email: "bellabarliana15@gmail.com", email_verified: false }),
);
const nobody = context("nobody", () => env.unauthenticatedContext());

const SHARED = [
  "guests",
  "vendors",
  "shortlist",
  "vendorCategories",
  "venues",
  "budgetItems",
  "hypotheticalItems",
  "checklistItems",
  "todos",
  "scheduleEvents",
  "notes",
  "fileFolders",
  "weddingFiles",
  "settings",
  "masterListItems",
  "masterListMeta",
  "funders",
  "guestMeta",
];

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(path).set(data);
  });
}

// Open access (2026-10-22): any signed-in account, anonymous ones included,
// gets in; only nobody signed in is still kept out.
const anonymous = context("anonymous", () =>
  env.authenticatedContext("uid-anonymous", { firebase: { sign_in_provider: "anonymous", identities: {} } }),
);
const outsiders: [string, () => RulesTestContext][] = [["nobody signed in", nobody]];

describe.each(SHARED)("%s", (name) => {
  it("any signed-in account can create, read, update and delete", async () => {
    for (const who of [gregory, bella, stranger, unverified, anonymous]) {
      const ref = who().firestore().collection(name).doc("x");
      await assertSucceeds(ref.set({ a: 1 }));
      await assertSucceeds(ref.get());
      await assertSucceeds(ref.update({ a: 2 }));
      await assertSucceeds(who().firestore().collection(name).get());
      await assertSucceeds(ref.delete());
    }
  });

  it.each(outsiders)("%s can't read or write", async (_, who) => {
    await seed(`${name}/x`, { a: 1 });
    const db = who().firestore();
    await assertFails(db.collection(name).doc("x").get());
    await assertFails(db.collection(name).get());
    await assertFails(db.collection(name).doc("y").set({ a: 1 }));
    await assertFails(db.collection(name).doc("x").update({ a: 2 }));
    await assertFails(db.collection(name).doc("x").delete());
  });
});

describe("members", () => {
  it("each account writes its own record and reads both", async () => {
    await assertSucceeds(gregory().firestore().doc("members/uid-gregory").set({ email: "g" }));
    await assertSucceeds(bella().firestore().doc("members/uid-bella").set({ email: "b" }));
    await assertSucceeds(gregory().firestore().collection("members").get());
    await assertSucceeds(bella().firestore().doc("members/uid-gregory").get());
  });

  it("an account can't write the other's record", async () => {
    await assertFails(gregory().firestore().doc("members/uid-bella").set({ email: "x" }));
  });

  it.each(outsiders)("%s can't read or write", async (_, who) => {
    await seed("members/uid-gregory", { email: "g" });
    await assertFails(who().firestore().doc("members/uid-gregory").get());
    await assertFails(who().firestore().doc("members/uid-stranger").set({ email: "s" }));
  });
});

describe("activity", () => {
  it("both accounts add entries in their own name and read everyone's", async () => {
    await assertSucceeds(gregory().firestore().collection("activity").add({ by: "uid-gregory", kind: "k" }));
    await assertSucceeds(bella().firestore().collection("activity").add({ by: "uid-bella", kind: "k" }));
    await assertSucceeds(bella().firestore().collection("activity").get());
  });

  it("no entry in the partner's name, and entries are never changed", async () => {
    await assertFails(gregory().firestore().collection("activity").add({ by: "uid-bella", kind: "k" }));
    await seed("activity/a", { by: "uid-gregory", kind: "k" });
    await assertFails(gregory().firestore().doc("activity/a").update({ kind: "x" }));
    await assertFails(gregory().firestore().doc("activity/a").delete());
  });

  it.each(outsiders)("%s can't read or write", async (_, who) => {
    await seed("activity/a", { by: "uid-gregory", kind: "k" });
    await assertFails(who().firestore().doc("activity/a").get());
    await assertFails(who().firestore().collection("activity").add({ by: "uid-stranger" }));
  });
});

describe("presence", () => {
  it("each account marks and clears only its own presence", async () => {
    const g = gregory().firestore();
    await assertSucceeds(g.doc("presence/doc1_uid-gregory").set({ documentId: "doc1", uid: "uid-gregory" }));
    await assertSucceeds(bella().firestore().collection("presence").get());
    await assertFails(bella().firestore().doc("presence/doc1_uid-gregory").delete());
    await assertFails(bella().firestore().doc("presence/doc1_uid-x").set({ documentId: "doc1", uid: "uid-gregory" }));
    // Neither can take over the other's entry by writing their own uid onto it (review P1-S22).
    await assertFails(bella().firestore().doc("presence/doc1_uid-gregory").set({ documentId: "doc1", uid: "uid-bella" }));
    await assertFails(bella().firestore().doc("presence/doc1_uid-gregory").update({ uid: "uid-bella" }));
    await assertSucceeds(g.doc("presence/doc1_uid-gregory").set({ documentId: "doc1", uid: "uid-gregory", at: 2 }));
    await assertSucceeds(g.doc("presence/doc1_uid-gregory").delete());
  });

  it("an entry's id is its document's and its own account's, so neither can make the other's (P5-S14)", async () => {
    const b = bella().firestore();
    await assertFails(b.doc("presence/doc2_uid-gregory").set({ documentId: "doc2", uid: "uid-bella" }));
    await assertFails(b.doc("presence/doc2_uid-bella").set({ documentId: "doc3", uid: "uid-bella" }));
    await assertSucceeds(b.doc("presence/doc2_uid-bella").set({ documentId: "doc2", uid: "uid-bella" }));
    await assertFails(b.doc("presence/doc2_uid-bella").set({ documentId: "doc3", uid: "uid-bella" }));
    await assertSucceeds(gregory().firestore().doc("presence/doc2_uid-gregory").set({ documentId: "doc2", uid: "uid-gregory" }));
  });

  it.each(outsiders)("%s can't read or write", async (_, who) => {
    await seed("presence/p", { uid: "uid-gregory" });
    await assertFails(who().firestore().doc("presence/p").get());
    await assertFails(who().firestore().doc("presence/q").set({ uid: "uid-stranger" }));
  });
});

describe("pushSubscriptions", () => {
  it("each account manages only its own devices", async () => {
    const g = gregory().firestore();
    await assertSucceeds(g.doc("pushSubscriptions/s1").set({ uid: "uid-gregory", endpoint: "e" }));
    await assertSucceeds(g.doc("pushSubscriptions/s1").get());
    await assertSucceeds(g.collection("pushSubscriptions").where("uid", "==", "uid-gregory").get());
    await assertFails(bella().firestore().doc("pushSubscriptions/s1").get());
    await assertFails(bella().firestore().doc("pushSubscriptions/s1").delete());
    await assertFails(bella().firestore().doc("pushSubscriptions/s2").set({ uid: "uid-gregory" }));
    await assertSucceeds(bella().firestore().doc("pushSubscriptions/s2").set({ uid: "uid-bella" }));
    // Neither can take over the other's subscription for another endpoint (review P1-S22).
    await assertFails(bella().firestore().doc("pushSubscriptions/s1").set({ uid: "uid-bella", endpoint: "e-other" }));
    await assertFails(g.doc("pushSubscriptions/s2").set({ uid: "uid-gregory" }));
    await assertSucceeds(g.doc("pushSubscriptions/s1").set({ uid: "uid-gregory", endpoint: "e2" }));
    await assertSucceeds(g.doc("pushSubscriptions/s1").delete());
    await assertSucceeds(g.doc("pushSubscriptions/s1").get());
  });

  it("a shared browser's subscription passes to whoever saves it, endpoint unchanged (P5-S13)", async () => {
    await assertSucceeds(gregory().firestore().doc("pushSubscriptions/s3").set({ uid: "uid-gregory", endpoint: "e3" }));
    // The same device, saved by the account now signed in on it, becomes theirs.
    await assertSucceeds(bella().firestore().doc("pushSubscriptions/s3").set({ uid: "uid-bella", endpoint: "e3" }));
    await assertSucceeds(bella().firestore().doc("pushSubscriptions/s3").get());
    await assertFails(gregory().firestore().doc("pushSubscriptions/s3").get());
    // Saved under someone else's uid: never.
    await assertFails(gregory().firestore().doc("pushSubscriptions/s3").set({ uid: "uid-bella", endpoint: "e3" }));
  });

  it.each(outsiders)("%s can't read or write", async (_, who) => {
    await seed("pushSubscriptions/s", { uid: "uid-stranger" });
    await assertFails(who().firestore().doc("pushSubscriptions/s").get());
    await assertFails(who().firestore().doc("pushSubscriptions/t").set({ uid: "uid-stranger" }));
  });
});

describe("appMeta", () => {
  it("both accounts read migration records but only the Admin SDK writes them", async () => {
    await seed("appMeta/migrations", { runs: [] });
    await assertSucceeds(gregory().firestore().doc("appMeta/migrations").get());
    await assertSucceeds(bella().firestore().doc("appMeta/migrations").get());
    await assertFails(gregory().firestore().doc("appMeta/migrations").set({ runs: [] }));
  });

  it.each(outsiders)("%s can't read", async (_, who) => {
    await seed("appMeta/migrations", { runs: [] });
    await assertFails(who().firestore().doc("appMeta/migrations").get());
  });
});

describe("collections not in the rules", () => {
  it("are closed to everyone", async () => {
    await assertFails(gregory().firestore().doc("somethingElse/x").set({ a: 1 }));
    await assertFails(gregory().firestore().doc("somethingElse/x").get());
  });
});
