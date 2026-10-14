import { describe, expect, it } from "vitest";
import {
  NO_GUEST_FILTER,
  filterGuests,
  headcounts,
  heads,
  isBusiness,
  isFilteringGuests,
  nextGuestNumber,
  sideOf,
  sides,
  type GuestRecord,
} from "@/lib/model/guests";

let n = 0;
const guest = (over: Partial<GuestRecord> = {}): GuestRecord => ({
  id: `g${++n}`,
  number: n,
  name: `Guest ${n}`,
  connection: "",
  country: "Indonesia",
  rsvpStatus: "pending",
  eventType: "Both",
  inviteSent: true,
  plusOnes: 0,
  allergies: "",
  ...over,
});

describe("heads", () => {
  it("counts the guest and their plus-ones", () => {
    expect(heads({ plusOnes: 0 })).toBe(1);
    expect(heads({ plusOnes: 2 })).toBe(3);
  });

  it("treats a cleared, negative or fractional number of plus-ones sensibly (§5 #10)", () => {
    expect(heads({ plusOnes: -3 })).toBe(1);
    expect(heads({ plusOnes: 1.9 })).toBe(2);
    expect(heads({ plusOnes: NaN })).toBe(1);
  });
});

describe("headcounts", () => {
  const guests = [
    guest({ eventType: "Both", rsvpStatus: "yes", plusOnes: 1 }), // 2
    guest({ eventType: "Both", rsvpStatus: "pending", plusOnes: 0 }), // 1
    guest({ eventType: "Both", rsvpStatus: "no", plusOnes: 2 }), // 3, declined
    guest({ eventType: "Matrimony", rsvpStatus: "yes", plusOnes: 0 }), // 1
    guest({ eventType: "Reception", rsvpStatus: "pending", plusOnes: 2 }), // 3
    guest({ eventType: "Reception Shortlist", rsvpStatus: "pending", plusOnes: 0 }), // 1
    guest({ eventType: "Unsure (Abroad)", rsvpStatus: "pending", plusOnes: 1 }), // 2
  ];

  it("counts attending as people, plus-ones included (§5 #9)", () => {
    const c = headcounts(guests);
    expect(c.attending).toBe(3);
    expect(c.waiting).toBe(1 + 3 + 1 + 2);
    expect(c.guests).toBe(7);
    expect(c.people).toBe(2 + 1 + 3 + 1 + 3 + 1 + 2);
  });

  it("leaves anyone not attending out of every event count", () => {
    const c = headcounts(guests);
    expect(c.both).toBe(3);
    expect(c.ceremony).toBe(3 + 1);
  });

  it("counts 'if space allows' towards the reception, not the ceremony (§5 #7)", () => {
    const c = headcounts(guests);
    expect(c.reception).toBe(3 + 3 + 1);
    expect(c.receptionIfSpace).toBe(1);
    expect(c.ceremony).toBe(4);
  });

  it("counts unsure, living abroad on its own (§5 #7)", () => {
    const c = headcounts(guests);
    expect(c.unsure).toBe(2);
    expect(c.both + c.reception).not.toBe(c.both + c.reception + c.unsure);
    expect(c.ceremony).toBe(4);
  });

  it("is all zeros with no guests", () => {
    expect(headcounts([])).toEqual({
      guests: 0,
      people: 0,
      attending: 0,
      waiting: 0,
      both: 0,
      reception: 0,
      receptionIfSpace: 0,
      ceremony: 0,
      unsure: 0,
    });
  });

  it("handles 1.500 guests", () => {
    const many = Array.from({ length: 1500 }, (_, i) =>
      guest({ rsvpStatus: i % 3 === 0 ? "yes" : "pending", plusOnes: i % 2 }),
    );
    const c = headcounts(many);
    expect(c.guests).toBe(1500);
    expect(c.people).toBe(1500 + 750);
    expect(c.attending + c.waiting).toBe(c.people);
  });
});

describe("sideOf", () => {
  it("finds the side a connection names", () => {
    expect(sideOf("Groom's uncle")).toBe("groom");
    expect(sideOf("Bride's colleague")).toBe("bride");
    expect(sideOf("groom's father's friend")).toBe("groom");
    expect(sideOf("GROOM'S COUSIN")).toBe("groom");
    expect(sideOf("新郎的同事")).toBe("groom");
    expect(sideOf("新娘的朋友")).toBe("bride");
  });

  it("lets the first side named win when both are named (§5 #8)", () => {
    expect(sideOf("Bride's aunt, married to the groom's uncle")).toBe("bride");
    expect(sideOf("Groom's friend from the bride's university")).toBe("groom");
  });

  it("gives nothing when no side is named", () => {
    expect(sideOf("Family friend")).toBeNull();
    expect(sideOf("")).toBeNull();
    expect(sideOf("Bridegroom's cousin")).toBeNull();
  });
});

describe("isBusiness", () => {
  it("recognises business words", () => {
    expect(isBusiness("Groom's colleague")).toBe(true);
    expect(isBusiness("Bride's business client")).toBe(true);
    expect(isBusiness("Groom's co-worker")).toBe(true);
    expect(isBusiness("Groom's Classmates")).toBe(true);
    expect(isBusiness("新郎的同事")).toBe(true);
  });

  it("counts friends and partners as family, not business (§5 #8)", () => {
    expect(isBusiness("Bride's friend")).toBe(false);
    expect(isBusiness("Bride's friends from university")).toBe(false);
    expect(isBusiness("Groom's partner")).toBe(false);
    expect(isBusiness("Groom's father's friend")).toBe(false);
  });

  it("matches whole words only", () => {
    expect(isBusiness("Groom's workshop teacher")).toBe(false);
    expect(isBusiness("Groom's officer")).toBe(false);
  });
});

describe("sides", () => {
  it("counts guests invited to both events, split by side and by family or business", () => {
    const s = sides([
      guest({ connection: "Groom's uncle", plusOnes: 1 }),
      guest({ connection: "Groom's colleague" }),
      guest({ connection: "Bride's aunt" }),
      guest({ connection: "Bride's friend from university", plusOnes: 1 }),
      guest({ connection: "Bride's business client", plusOnes: 2 }),
    ]);
    expect(s).toEqual({ groomFamily: 2, groomBusiness: 1, brideFamily: 1 + 2, brideBusiness: 3, notCounted: 0 });
  });

  it("counts a guest who names both sides on one side only (§5 #8)", () => {
    const s = sides([guest({ connection: "Bride's colleague who knows the groom", plusOnes: 1 })]);
    expect(s.brideBusiness).toBe(2);
    expect(s.groomBusiness + s.groomFamily).toBe(0);
  });

  it("counts people whose connection names no side apart", () => {
    const s = sides([guest({ connection: "Family friend", plusOnes: 2 }), guest({ connection: "" })]);
    expect(s.notCounted).toBe(4);
    expect(s.groomFamily + s.brideFamily + s.groomBusiness + s.brideBusiness).toBe(0);
  });

  it("leaves out guests not invited to both events, and anyone not attending", () => {
    const s = sides([
      guest({ connection: "Groom's uncle", eventType: "Reception" }),
      guest({ connection: "Groom's aunt", eventType: "Matrimony" }),
      guest({ connection: "Groom's cousin", eventType: "Unsure (Abroad)" }),
      guest({ connection: "Groom's brother", rsvpStatus: "no" }),
      guest({ connection: "Bride's sister", rsvpStatus: "yes" }),
    ]);
    expect(s).toEqual({ groomFamily: 0, groomBusiness: 0, brideFamily: 1, brideBusiness: 0, notCounted: 0 });
  });
});

describe("filterGuests", () => {
  const list = [
    guest({ name: "王小明", connection: "新郎的同事", country: "China", rsvpStatus: "yes", eventType: "Both" }),
    guest({ name: "Sarah Lim", connection: "Bride's colleague", country: "Singapore", rsvpStatus: "pending", eventType: "Reception" }),
    guest({ name: "Ayu", connection: "Bride's friend", allergies: "Allergic to peanuts", rsvpStatus: "pending", eventType: "Both" }),
  ];

  it("searches names, connections, countries and food notes", () => {
    expect(filterGuests(list, { ...NO_GUEST_FILTER, query: "singapore" }).map((g) => g.name)).toEqual(["Sarah Lim"]);
    expect(filterGuests(list, { ...NO_GUEST_FILTER, query: "peanut" }).map((g) => g.name)).toEqual(["Ayu"]);
    expect(filterGuests(list, { ...NO_GUEST_FILTER, query: "同事" }).map((g) => g.name)).toEqual(["王小明"]);
    expect(filterGuests(list, { ...NO_GUEST_FILTER, query: "colleague" }).map((g) => g.name)).toEqual(["Sarah Lim"]);
  });

  it("combines the RSVP and invited-to filters", () => {
    expect(filterGuests(list, { ...NO_GUEST_FILTER, rsvp: "pending" })).toHaveLength(2);
    expect(filterGuests(list, { ...NO_GUEST_FILTER, rsvp: "pending", invite: "Both" }).map((g) => g.name)).toEqual(["Ayu"]);
    expect(filterGuests(list, { ...NO_GUEST_FILTER, rsvp: "no" })).toEqual([]);
  });

  it("knows when something is filtering", () => {
    expect(isFilteringGuests(NO_GUEST_FILTER)).toBe(false);
    expect(isFilteringGuests({ ...NO_GUEST_FILTER, query: "  " })).toBe(false);
    expect(isFilteringGuests({ ...NO_GUEST_FILTER, rsvp: "yes" })).toBe(true);
    expect(isFilteringGuests({ ...NO_GUEST_FILTER, invite: "Both" })).toBe(true);
  });
});

describe("nextGuestNumber", () => {
  it("is one more than the highest number, so a removed guest's number isn't reused", () => {
    expect(nextGuestNumber([])).toBe(1);
    expect(nextGuestNumber([{ number: 1 }, { number: 20 }, { number: 3 }])).toBe(21);
    expect(nextGuestNumber([{ number: null }, {}])).toBe(1);
  });

  it("follows the counter when it has run further", () => {
    expect(nextGuestNumber([{ number: 4 }], 9)).toBe(10);
    expect(nextGuestNumber([{ number: 12 }], 9)).toBe(13);
  });
});
