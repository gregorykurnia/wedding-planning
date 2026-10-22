import { describe, expect, it } from "vitest";
import {
  PARTNER_FALLBACK,
  continueAs,
  nameOfAccount,
  otherSlot,
  readSlots,
  slotOf,
  swappedSlots,
  whoAsk,
  whoIs,
  type WhoSettings,
} from "@/lib/model/who";

// Guide §5.1 and §6.3, N3: which of the two names belongs to which account.

const settings = (extra: Partial<WhoSettings> = {}): WhoSettings => ({
  yourName: "Greg",
  partnerName: "Bella",
  partnerEmail: "",
  ...extra,
});

describe("which name an account holds", () => {
  it("reads an account's own entry first", () => {
    const s = settings({ accountSlots: { g: "first", b: "second" } });
    expect(slotOf(s, "g", "greg@x.com")).toBe("first");
    expect(slotOf(s, "b", "bella@x.com")).toBe("second");
  });

  it("gives the other account the other name without asking", () => {
    expect(slotOf(settings({ accountSlots: { g: "first" } }), "b", "")).toBe("second");
    expect(slotOf(settings({ accountSlots: { b: "second" } }), "g", "")).toBe("first");
  });

  it("is unknown for a third account when both places are held", () => {
    expect(slotOf(settings({ accountSlots: { g: "first", b: "second" } }), "x", "")).toBeNull();
  });

  it("falls back to the second name's email for settings from before pairing", () => {
    const s = settings({ partnerEmail: "Bella@X.com" });
    expect(slotOf(s, "b", "bella@x.com")).toBe("second");
    expect(slotOf(s, "g", "greg@x.com")).toBe("first");
    expect(slotOf(settings(), "g", "greg@x.com")).toBeNull();
  });

  it("keeps the pairing when a name is spelled differently", () => {
    const before = settings({ accountSlots: { g: "first" } });
    const after = { ...before, yourName: "Gregory" };
    expect(slotOf(after, "g", "")).toBe(slotOf(before, "g", ""));
    expect(whoIs(after, "g", "").myName).toBe("Gregory");
  });

  it("ignores anything stored that isn't a place", () => {
    expect(readSlots({ a: "first", b: "third", c: 3 })).toEqual({ a: "first" });
    expect(readSlots(null)).toEqual({});
    expect(readSlots("first")).toEqual({});
  });
});

describe("names", () => {
  const s = settings({ accountSlots: { g: "first", b: "second" } });

  it("names me and my partner", () => {
    expect(whoIs(s, "g", "")).toEqual({ mine: "first", myName: "Greg", partnerName: "Bella" });
    expect(whoIs(s, "b", "")).toEqual({ mine: "second", myName: "Bella", partnerName: "Greg" });
  });

  it("says Your partner until a name is set, and nothing for my own", () => {
    const bare = settings({ yourName: "", partnerName: "", accountSlots: { g: "first" } });
    expect(whoIs(bare, "g", "")).toEqual({ mine: "first", myName: "", partnerName: PARTNER_FALLBACK });
    expect(whoIs(settings(), "g", "").partnerName).toBe(PARTNER_FALLBACK);
  });

  it("names whoever's account made a change, from either side", () => {
    expect(nameOfAccount(s, "b", "g", "")).toBe("Bella");
    expect(nameOfAccount(s, "g", "g", "")).toBe("Greg");
    // An account the pairing doesn't list is the other one from here.
    expect(nameOfAccount(settings({ accountSlots: { g: "first" } }), "b", "g", "")).toBe("Bella");
  });
});

describe("what the first sign-in asks", () => {
  it("asks nothing once the account has a name", () => {
    expect(whoAsk(settings({ accountSlots: { g: "first" } }), "g", "")).toBe("none");
    expect(whoAsk(settings({ accountSlots: { g: "first" } }), "b", "")).toBe("none");
  });

  it("asks which of the two names when both are set", () => {
    expect(whoAsk(settings(), "g", "greg@x.com")).toBe("choose");
  });

  it("asks for the two names when they aren't both set", () => {
    expect(whoAsk(settings({ yourName: "", partnerName: "" }), "g", "")).toBe("names");
    expect(whoAsk(settings({ partnerName: " " }), "g", "")).toBe("names");
  });
});

describe("swapping", () => {
  it("trades this account's name and the other's", () => {
    const s = settings({ accountSlots: { g: "first", b: "second" } });
    expect(swappedSlots(s, "g", "", "b")).toEqual({ g: "second", b: "first" });
    expect(swappedSlots(s, "b", "", "g")).toEqual({ b: "first", g: "second" });
  });

  it("swaps just this account when the other hasn't signed in", () => {
    expect(swappedSlots(settings({ accountSlots: { g: "first" } }), "g", "", null)).toEqual({ g: "second" });
  });

  it("keeps the other account's place when the members list hasn't caught up", () => {
    const s = settings({ accountSlots: { g: "first", b: "second" } });
    expect(swappedSlots(s, "g", "", null)).toEqual({ g: "second", b: "first" });
  });

  it("works from the old email pairing too, and does nothing while this account has no name", () => {
    expect(swappedSlots(settings({ partnerEmail: "b@x.com" }), "g", "g@x.com", "b")).toEqual({ g: "second", b: "first" });
    expect(swappedSlots(settings(), "g", "", null)).toBeNull();
  });

  it("flips a place", () => {
    expect(otherSlot("first")).toBe("second");
    expect(otherSlot("second")).toBe("first");
  });
});

describe("words", () => {
  it("says Continue as the chosen name, or Continue before one is chosen", () => {
    expect(continueAs("Bella")).toBe("Continue as Bella");
    expect(continueAs(null)).toBe("Continue");
  });
});
