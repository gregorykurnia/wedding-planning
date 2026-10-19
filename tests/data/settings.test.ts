import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { saveCoupleName, saveWeddingDate } from "@/lib/data/settings";
import { startNames, swapNames } from "@/lib/data/who";
import { clearFirestore, closeClient, twoPartners, type Partner } from "./emulator";

// Task 4.25: the settings screen's writes, against the emulators (guide §5.3).

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

const g = () => ({ db: gregory.db });
const b = () => ({ db: bella.db });

const wedding = async () => (await getDoc(doc(gregory.db, "settings", "wedding"))).data();
const slots = async () => (await getDoc(doc(gregory.db, "settings", "accounts"))).data()?.slots;

describe("saving the names and the date as you go (plan §5 #26)", () => {
  it("writes one name without touching the other name or the date", async () => {
    await setDoc(doc(gregory.db, "settings", "wedding"), {
      yourName: "Greg",
      partnerName: "Bella",
      weddingDate: "2027-06-12",
    });
    await saveCoupleName("partnerName", "  Isabella ", g());
    expect(await wedding()).toMatchObject({ yourName: "Greg", partnerName: "Isabella", weddingDate: "2027-06-12" });
  });

  it("keeps two names changed at once on two phones", async () => {
    await setDoc(doc(gregory.db, "settings", "wedding"), { yourName: "Greg", partnerName: "Bella" });
    await Promise.all([saveCoupleName("yourName", "Gregory", g()), saveCoupleName("partnerName", "Isabella", b())]);
    expect(await wedding()).toMatchObject({ yourName: "Gregory", partnerName: "Isabella" });
  });

  it("changes the date without touching the names, and works before settings exist", async () => {
    await saveWeddingDate("2027-06-12", g());
    expect(await wedding()).toMatchObject({ weddingDate: "2027-06-12" });
    await saveCoupleName("yourName", "Greg", g());
    await saveWeddingDate("2027-07-03", b());
    expect(await wedding()).toMatchObject({ yourName: "Greg", weddingDate: "2027-07-03" });
  });
});

describe("Swap them (N3)", () => {
  const settings = (accountSlots: Record<string, "first" | "second">) => ({
    yourName: "Greg",
    partnerName: "Bella",
    partnerEmail: "",
    accountSlots,
  });

  it("trades the two accounts' places, and undo puts them back", async () => {
    await setDoc(doc(gregory.db, "settings", "accounts"), { slots: { [gregory.uid]: "first", [bella.uid]: "second" } });
    const done = await swapNames(
      settings({ [gregory.uid]: "first", [bella.uid]: "second" }),
      "gregory@example.com",
      [{ id: gregory.uid }, { id: bella.uid }],
      g(),
    );
    expect(done?.slot).toBe("second");
    expect(await slots()).toEqual({ [gregory.uid]: "second", [bella.uid]: "first" });

    await done?.undo();
    expect(await slots()).toEqual({ [gregory.uid]: "first", [bella.uid]: "second" });
  });
});

// Phase 5 review B1: asked for the names by mistake (offline, the settings not yet read).
describe("the first sign-in's names", () => {
  it("writes both names and holds the first place for this account", async () => {
    await startNames(" Greg ", "Bella", g());
    expect(await wedding()).toMatchObject({ yourName: "Greg", partnerName: "Bella" });
    expect(await slots()).toEqual({ [gregory.uid]: "first" });
  });

  it("never writes over names already set, and leaves the pairing alone", async () => {
    await setDoc(doc(gregory.db, "settings", "wedding"), { yourName: "Greg", partnerName: "Bella" });
    await expect(startNames("Bella", "Greg", b())).rejects.toMatchObject({ code: "changed" });
    expect(await wedding()).toMatchObject({ yourName: "Greg", partnerName: "Bella" });
    expect(await slots()).toBeUndefined();
  });

  it("is safe to try again once the first try landed", async () => {
    await startNames("Greg", "Bella", g());
    await startNames("Greg", "Bella", g());
    expect(await wedding()).toMatchObject({ yourName: "Greg", partnerName: "Bella" });
  });
});
