import { describe, expect, it } from "vitest";
import {
  PRESENCE_FRESH_MS,
  PRESENCE_HEARTBEAT_MS,
  flashTargets,
  isRemoval,
  ownToast,
  partnerIsHere,
  activityNews,
  burstToast,
  mergeNewsBurst,
  partnerToast,
  removes,
} from "@/lib/model/partner";

const TODAY = "2026-10-14";
const toast = (kind: string, params: Record<string, string | number | boolean | null>) =>
  partnerToast("Bella", kind, params, TODAY);

describe("partner toast words (guide §6.3)", () => {
  it("says what was recorded and for whom", () => {
    expect(toast("payment.recorded", { amount: 55500000, name: "Dapur Lestari Catering" })).toBe(
      "Bella recorded Rp 55.500.000 for Dapur Lestari Catering",
    );
    expect(toast("payment.recorded", { amount: 1000 })).toBe("Bella recorded Rp 1.000");
    expect(toast("payment.recorded", {})).toBe("Bella recorded a payment");
  });

  it("names what was added, keeping quotes for things you name yourself", () => {
    expect(toast("vendor.added", { name: "Bunga Melati Florist" })).toBe("Bella added Bunga Melati Florist");
    expect(toast("venue.added", { name: "Bukit Jimbaran Lawn" })).toBe("Bella added Bukit Jimbaran Lawn");
    expect(toast("booking.added", { name: "Harmoni String Quartet" })).toBe("Bella added Harmoni String Quartet");
    expect(toast("finalist.added", { name: "Lumina Wedding Photography" })).toBe(
      "Bella added Lumina Wedding Photography to the shortlist",
    );
    expect(toast("whatif.added", { name: "Live band for the reception" })).toBe(
      "Bella added “Live band for the reception”",
    );
    expect(toast("document.added", { name: "First dance shortlist" })).toBe(
      "Bella started “First dance shortlist”",
    );
    expect(toast("file.uploaded", { name: "Contract.pdf" })).toBe("Bella uploaded Contract.pdf");
  });

  it("says when a new event is", () => {
    const name = "Makeup trial with Kirana";
    expect(toast("event.added", { name, date: "2026-10-15", time: "10:00" })).toBe(
      "Bella added “Makeup trial with Kirana” tomorrow at 10:00",
    );
    expect(toast("event.added", { name, date: "2026-10-14" })).toBe("Bella added “Makeup trial with Kirana” today");
    expect(toast("event.added", { name, date: "2026-10-30", time: "09:30" })).toBe(
      "Bella added “Makeup trial with Kirana” Friday 30 October at 09:30",
    );
    expect(toast("event.added", { name })).toBe("Bella added “Makeup trial with Kirana”");
  });

  it("covers tasks, guests, items and bookings", () => {
    expect(toast("task.finished", { name: "Tasting at Sendok Emas" })).toBe(
      "Bella finished “Tasting at Sendok Emas”",
    );
    expect(toast("guest.replied", { name: "王小明", reply: "yes" })).toBe("Bella marked 王小明 as attending");
    expect(toast("guest.replied", { name: "Ana", reply: "no" })).toBe("Bella marked Ana as not attending");
    expect(toast("guest.replied", { name: "Ana", reply: "pending" })).toBe("Bella marked Ana as waiting");
    expect(toast("item.confirmed", { name: "Wedding cake" })).toBe("Bella confirmed Wedding cake");
    expect(toast("vendor.booked", { name: "Kirana" })).toBe("Bella booked Kirana");
    expect(toast("booking.split", { name: "Kirana" })).toBe("Bella split Kirana into parts");
  });

  it("never prints an empty name or a stray quote mark", () => {
    expect(toast("vendor.added", { name: "  " })).toBe("Bella added something");
    expect(toast("whatif.added", {})).toBe("Bella added something");
  });

  it("has no toast for removals or kinds it doesn't know", () => {
    expect(toast("booking.removed", { name: "Kirana" })).toBeNull();
    expect(toast("vendor.removed", { name: "Kirana" })).toBeNull();
    expect(toast("something.new", { name: "x" })).toBeNull();
  });
});

describe("removals", () => {
  it("knows removed and deleted kinds", () => {
    expect(isRemoval("booking.removed")).toBe(true);
    expect(isRemoval("document.deleted")).toBe(true);
    expect(isRemoval("booking.added")).toBe(false);
    expect(isRemoval("removed.later")).toBe(false);
  });

  it("matches only the record being viewed", () => {
    const entry = { kind: "booking.removed", target: { kind: "booking", id: "vendor-a" } };
    expect(removes(entry, { kind: "booking", id: "vendor-a" })).toBe(true);
    expect(removes(entry, { kind: "booking", id: "vendor-b" })).toBe(false);
    expect(removes(entry, { kind: "vendor", id: "vendor-a" })).toBe(false);
    expect(removes({ kind: "booking.added", target: entry.target }, { kind: "booking", id: "vendor-a" })).toBe(false);
    expect(removes({ kind: "booking.removed", target: null }, { kind: "booking", id: "vendor-a" })).toBe(false);
  });
});

describe("what flashes", () => {
  it("flashes the target, and a part's booking with it", () => {
    expect(flashTargets(null)).toEqual([]);
    expect(flashTargets({ kind: "vendor", id: "v1" })).toEqual([{ kind: "vendor", id: "v1" }]);
    expect(flashTargets({ kind: "booking", id: "vendor-a", partId: "p1" })).toEqual([
      { kind: "booking", id: "vendor-a", partId: "p1" },
      { kind: "booking", id: "vendor-a" },
    ]);
  });
});

describe("presence", () => {
  const NOW = 1_000_000;

  it("beats faster than it expires, with room for a missed beat", () => {
    expect(PRESENCE_HEARTBEAT_MS).toBe(20_000);
    expect(PRESENCE_FRESH_MS).toBe(45_000);
    expect(PRESENCE_FRESH_MS).toBeGreaterThan(PRESENCE_HEARTBEAT_MS * 2);
  });

  it("is also here while the other account's heartbeat is under 45 seconds old", () => {
    expect(partnerIsHere([{ uid: "bella", at: NOW - 44_999 }], "greg", NOW)).toBe(true);
    expect(partnerIsHere([{ uid: "bella", at: NOW - 45_000 }], "greg", NOW)).toBe(false);
  });

  it("ignores my own entry, a pending one and nobody", () => {
    expect(partnerIsHere([{ uid: "greg", at: NOW }], "greg", NOW)).toBe(false);
    expect(partnerIsHere([{ uid: "bella", at: null }], "greg", NOW)).toBe(false);
    expect(partnerIsHere([], "greg", NOW)).toBe(false);
  });

  it("counts an entry as the partner's when I'm not signed in to anything yet", () => {
    expect(partnerIsHere([{ uid: "bella", at: NOW }], null, NOW)).toBe(true);
  });

  it("measures against my own latest server time, not the device clock (review P2-S2)", () => {
    const both = [
      { uid: "bella", at: NOW - 30_000 },
      { uid: "greg", at: NOW - 40_000 },
      { uid: "greg", at: NOW - 25_000 },
    ];
    // The device clock runs two minutes fast, then two minutes slow.
    expect(partnerIsHere(both, "greg", NOW + 120_000)).toBe(true);
    const stale = [{ uid: "bella", at: NOW - 60_000 }, { uid: "greg", at: NOW }];
    expect(partnerIsHere(stale, "greg", NOW - 120_000)).toBe(false);
  });
});

describe("activityNews (review P2-S3)", () => {
  it("takes the first server snapshot as seen, then says each later entry once", () => {
    const news = activityNews();
    expect(news({ fromCache: false, added: ["a", "b"] })).toEqual([]);
    expect(news({ fromCache: false, added: ["c"] })).toEqual(["c"]);
    expect(news({ fromCache: false, added: ["c", "d"] })).toEqual(["d"]);
  });

  it("waits for the server: cached entries and the server's first answer are both old", () => {
    const news = activityNews();
    expect(news({ fromCache: true, added: ["a"] })).toEqual([]);
    expect(news({ fromCache: false, added: ["b"] })).toEqual([]);
    expect(news({ fromCache: false, added: ["c"] })).toEqual(["c"]);
  });
});

describe("your own change from another device (N3)", () => {
  const own = (kind: string, params: Record<string, string | number | boolean | null>, device: "phone" | "computer" = "phone") =>
    ownToast(kind, params, TODAY, device);

  it("says You and which device, as the guide does", () => {
    expect(own("payment.recorded", { amount: 55500000, name: "Dapur Lestari Catering" })).toBe(
      "You recorded Rp 55.500.000 for Dapur Lestari Catering on your other phone",
    );
    expect(own("vendor.added", { name: "Bunga Melati Florist" }, "computer")).toBe(
      "You added Bunga Melati Florist on your other computer",
    );
    expect(own("event.added", { name: "Cake tasting", date: "2026-10-15", time: "10:00" })).toBe(
      "You added “Cake tasting” tomorrow at 10:00 on your other phone",
    );
  });

  it("has no toast for a removal or a kind it doesn't know, as for the partner", () => {
    expect(own("booking.removed", { name: "x" })).toBeNull();
    expect(own("something.new", {})).toBeNull();
  });
});

describe("a burst of news (P5-S26)", () => {
  const news = (id: string, own: boolean, text: string | null) => ({ id, name: own ? "Greg" : "Bella", own, text, flash: [id] });
  const summary = (first: { name: string; own: boolean }, count: number) => burstToast(first.name, count, first.own);

  it("leaves up to three toasts as they are", () => {
    const three = [news("a", false, "A"), news("b", false, "B"), news("c", false, "C"), news("d", true, "D")];
    expect(mergeNewsBurst(three, summary)).toEqual(three);
  });

  it("merges more than three of the partner's into one toast, keeping every flash and your own toasts apart", () => {
    const many = [news("a", false, "A"), news("b", false, null), news("c", false, "C"), news("d", false, "D"), news("e", false, "E"), news("o", true, "O")];
    const merged = mergeNewsBurst(many, summary);
    expect(merged.filter((n) => n.text).map((n) => n.text)).toEqual(["Bella made 4 changes. Everything here is up to date.", "O"]);
    expect(merged.flatMap((n) => n.flash)).toEqual(["a", "b", "c", "d", "e", "o"]);
    expect(merged[0]).toMatchObject({ id: "a-burst", text: "Bella made 4 changes. Everything here is up to date." });
  });

  it("words your own burst from another device without naming the partner", () => {
    expect(burstToast("Greg", 5, true)).toBe("You made 5 changes on another device. Everything here is up to date.");
  });
});
