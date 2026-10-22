import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { logActivity } from "@/lib/data/activity";
import { recordMember } from "@/lib/data/members";
import { createNumberedGuest } from "@/lib/collections/guest-meta";
import { markAbsent, markPresent } from "@/lib/collections/presence";
import {
  removePushSubscription,
  savePushSubscription,
  subscriptionId,
} from "@/lib/collections/push-subscriptions";
import { addFunder, renameFunder } from "@/lib/collections/funders";
import { activityFromDoc } from "@/lib/collections/activity";
import { removeWithUndo } from "@/lib/data/undo";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

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

describe("activity", () => {
  it("records who did what, and the partner reads it", async () => {
    expect(
      await logActivity("payment.recorded", { amount: 55_500_000, name: "Dapur Lestari" }, { kind: "booking", id: "vendor-v1" }, { db: bella.db }),
    ).toBe(true);
    const all = await getDocs(collection(gregory.db, "activity"));
    expect(all.size).toBe(1);
    const entry = activityFromDoc(all.docs[0].id, all.docs[0].data());
    expect(entry).toMatchObject({
      by: bella.uid,
      kind: "payment.recorded",
      params: { amount: 55_500_000, name: "Dapur Lestari" },
      target: { kind: "booking", id: "vendor-v1" },
    });
    expect(entry.at).toBeTypeOf("number");
  });
});

describe("members", () => {
  it("each account records itself at sign-in", async () => {
    await recordMember(gregory.auth.currentUser!, { db: gregory.db });
    await recordMember(bella.auth.currentUser!, { db: bella.db });
    const all = await getDocs(collection(gregory.db, "members"));
    expect(all.docs.map((d) => d.id).sort()).toEqual([gregory.uid, bella.uid].sort());
    expect((await getDoc(doc(bella.db, "members", gregory.uid))).data()).toMatchObject({
      email: "gregory.kurnia@gmail.com",
      provider: "password",
    });
  });

  it("resolves false instead of throwing when the write is refused", async () => {
    const other = { uid: bella.uid, email: "x", providerData: [] };
    expect(await recordMember(other, { db: gregory.db })).toBe(false);
  });
});

describe("guest numbers", () => {
  it("never gives two guests added at the same moment the same number, and never reuses one", async () => {
    const added = await Promise.all([
      createNumberedGuest({ name: "Maria" }, { db: gregory.db }),
      createNumberedGuest({ name: "Wayan" }, { db: bella.db }),
      createNumberedGuest({ name: "王小明" }, { db: gregory.db }),
    ]);
    expect(added.map((g) => g.number).sort()).toEqual([1, 2, 3]);

    await removeWithUndo("guests", added.find((g) => g.number === 3)!.id, { db: bella.db });
    const next = await createNumberedGuest({ name: "Kirana" }, { db: bella.db });
    expect(next.number).toBe(4);
    expect((await getDoc(doc(gregory.db, "guests", next.id))).data()).toMatchObject({
      name: "Kirana",
      number: 4,
      createdBy: bella.uid,
    });
  });

  it("a retried add keeps the first number", async () => {
    const first = await createNumberedGuest({ name: "Maria" }, { db: gregory.db, id: "g1" });
    const again = await createNumberedGuest({ name: "Maria" }, { db: gregory.db, id: "g1" });
    expect(again).toEqual(first);
    expect((await getDoc(doc(gregory.db, "guestMeta", "counter"))).data()?.next).toBe(2);
  });

  it("a retried add writes what was changed before Try again (Phase 4 review S22)", async () => {
    await createNumberedGuest({ name: "Maria", country: "" }, { db: gregory.db, id: "g1" });
    const again = await createNumberedGuest({ name: "Maria Lestari", country: "Indonesia" }, { db: gregory.db, id: "g1" });
    expect(again).toEqual({ id: "g1", number: 1 });
    expect((await getDoc(doc(gregory.db, "guests", "g1"))).data()).toMatchObject({ name: "Maria Lestari", country: "Indonesia", number: 1 });
    expect((await getDoc(doc(gregory.db, "guestMeta", "counter"))).data()?.next).toBe(2);
  });

  it("a retried add writes only what changed since the first try, keeping the partner's edit (Phase 5 review S20)", async () => {
    const first = { name: "Maria", country: "", allergies: "" };
    await createNumberedGuest(first, { db: gregory.db, id: "g1" });
    await setDoc(doc(bella.db, "guests", "g1"), { allergies: "Peanuts" }, { merge: true });
    await createNumberedGuest({ name: "Maria", country: "Indonesia", allergies: "" }, { db: gregory.db, id: "g1", first });
    expect((await getDoc(doc(gregory.db, "guests", "g1"))).data()).toMatchObject({ name: "Maria", country: "Indonesia", allergies: "Peanuts", number: 1 });
  });
});

describe("presence", () => {
  it("marks and clears this account in a document", async () => {
    await markPresent("doc1", gregory.db);
    await markPresent("doc1", bella.db);
    const q = query(collection(gregory.db, "presence"), where("documentId", "==", "doc1"));
    expect((await getDocs(q)).docs.map((d) => d.data().uid).sort()).toEqual([gregory.uid, bella.uid].sort());
    await markAbsent("doc1", bella.db);
    expect((await getDocs(q)).docs.map((d) => d.data().uid)).toEqual([gregory.uid]);
  });
});

describe("push subscriptions", () => {
  it("saves and removes this device's subscription under a stable id", async () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc/def";
    expect(subscriptionId(endpoint)).toBe(subscriptionId(endpoint));
    expect(subscriptionId(endpoint)).not.toContain("/");
    await savePushSubscription({ endpoint, keys: { p256dh: "p", auth: "a" } }, "iPhone", gregory.db);
    const ref = doc(gregory.db, "pushSubscriptions", subscriptionId(endpoint));
    expect((await getDoc(ref)).data()).toMatchObject({ uid: gregory.uid, device: "iPhone" });
    await removePushSubscription(endpoint, gregory.db);
    expect((await getDoc(ref)).exists()).toBe(false);
  });
});

describe("funders", () => {
  it("adds and renames a funder", async () => {
    const id = await addFunder("  Grandma ", 4, { db: gregory.db });
    await renameFunder(id, "Oma", { db: bella.db });
    expect((await getDoc(doc(gregory.db, "funders", id))).data()).toMatchObject({ name: "Oma", order: 4 });
  });
});
