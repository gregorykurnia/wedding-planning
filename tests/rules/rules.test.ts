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
 * Both accounts can read and write every collection; anyone else, an
 * unverified allowlisted address, or nobody signed in can't (Task 1.9).
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

const outsiders: [string, () => RulesTestContext][] = [
  ["another account", stranger],
  ["an unverified allowlisted address", unverified],
  ["nobody signed in", nobody],
];

describe.each(SHARED)("%s", (name) => {
  it("both accounts can create, read, update and delete", async () => {
    for (const who of [gregory, bella]) {
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
    await assertSucceeds(g.doc("presence/doc1_uid-gregory").delete());
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
    await assertSucceeds(g.doc("pushSubscriptions/s1").delete());
    await assertSucceeds(g.doc("pushSubscriptions/s1").get());
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
