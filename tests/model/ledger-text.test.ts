import { describe, expect, it } from "vitest";
import type { Booking, Part } from "@/lib/model/bookings";
import { NOT_ASSIGNED, type Due, type Funder, type WhatIfRecord } from "@/lib/model/money";
import {
  bookingMeta,
  bookingPaidBy,
  bookingStatus,
  dateCardParts,
  dueTail,
  dueWhen,
  estimateText,
  extractText,
  fileMeta,
  fileSizeText,
  folderMeta,
  funderName,
  NO_TEXT,
  pathText,
  ratingParts,
  vendorMeta,
  whatIfMeta,
  whatIfPartLines,
} from "@/veil/parts/rows/ledger-text";

// Task 3.5: the words of the ledger rows (guide §4.7), read without rendering.
// "Today" is 14 October 2026, a Wednesday, as the design guide fixes it.

const TODAY = "2026-10-14";

const FUNDERS: Funder[] = [
  { id: "greg", name: "Greg" },
  { id: "bella-fam", name: "Bella’s family" },
  { id: "ck", name: "CK" },
];

const part = (over: Partial<Part> & Pick<Part, "id" | "name">): Part => ({
  price: 0,
  paid: 0,
  funder: null,
  due: null,
  step: "",
  ...over,
});

const booking = (over: Partial<Booking> & Pick<Booking, "id" | "name">): Booking => ({
  kind: "vendor",
  recordId: over.id,
  category: "",
  price: 0,
  paid: 0,
  funder: null,
  due: null,
  step: "",
  parts: [],
  estimate: null,
  bookedOn: null,
  from: null,
  direct: false,
  ...over,
});

const decoration = booking({
  id: "vendor-v1",
  name: "Pelaminan Ayu",
  category: "Decoration",
  estimate: 22_000_000,
  parts: [
    part({ id: "p1", name: "Deposit", price: 5_000_000, paid: 5_000_000, funder: "greg" }),
    part({ id: "p2", name: "Final payment", price: 20_000_000, funder: "bella-fam", due: "2026-10-30", step: "Pay the balance" }),
  ],
});

describe("funders and who pays", () => {
  it("names a funder, reads a missing one as Not assigned, and Not assigned for null", () => {
    expect(funderName(FUNDERS, "greg")).toBe("Greg");
    expect(funderName(FUNDERS, "gone")).toBe(NOT_ASSIGNED);
    expect(funderName(FUNDERS, null)).toBe(NOT_ASSIGNED);
  });

  it("writes who pays a booking: names, a count past two, or no funder yet", () => {
    expect(bookingPaidBy(["greg", "bella-fam"], FUNDERS)).toBe("paid by Greg and Bella’s family");
    expect(bookingPaidBy(["greg", "bella-fam", "ck"], FUNDERS)).toBe("paid by 3 funders");
    expect(bookingPaidBy(["greg", null], FUNDERS)).toBe("paid by Greg and Not assigned");
    expect(bookingPaidBy([null], FUNDERS)).toBe("no funder yet");
    expect(bookingPaidBy([], FUNDERS)).toBe("no funder yet");
  });
});

describe("booking entries", () => {
  it("says how far the price is from the estimate, over or under, and nothing when equal", () => {
    expect(estimateText(decoration)).toBe(", Rp 3.000.000 over the estimate");
    expect(estimateText({ ...decoration, estimate: 30_000_000 })).toBe(", Rp 5.000.000 under the estimate");
    expect(estimateText({ ...decoration, estimate: 25_000_000 })).toBe("");
    expect(estimateText({ ...decoration, estimate: null })).toBe("");
  });

  it("writes the meta line with the category, who pays and the estimate", () => {
    expect(bookingMeta(decoration, FUNDERS)).toBe(
      "Decoration, paid by Greg and Bella’s family, Rp 3.000.000 over the estimate",
    );
    expect(bookingMeta(booking({ id: "venue-h1", name: "Hotel" }), FUNDERS)).toBe("No category, no funder yet");
  });

  it("gives the status: to pay, late in rose, paid in full, overpaid, or no price yet", () => {
    expect(bookingStatus(decoration, TODAY)).toEqual({ text: "Rp 20.000.000 to pay", tone: "plain", amount: "Rp 20.000.000" });
    const late = booking({ id: "vendor-v3", name: "Dimas", price: 15_000_000, paid: 5_000_000, funder: "ck", due: "2026-10-10" });
    expect(bookingStatus(late, TODAY)).toEqual({ text: "Rp 10.000.000 late", tone: "late", amount: "Rp 10.000.000" });
    const paid = booking({ id: "vendor-v2", name: "Catering", price: 55_500_000, paid: 55_500_000 });
    expect(bookingStatus(paid, TODAY)).toEqual({ text: "Paid in full", tone: "done", amount: null });
    const over = booking({ id: "venue-h1", name: "Hotel", price: 10_000_000, paid: 11_000_000 });
    expect(bookingStatus(over, TODAY)).toEqual({ text: "Overpaid by Rp 1.000.000", tone: "late", amount: "Rp 1.000.000" });
    const none = booking({ id: "vendor-v5", name: "Florist" });
    expect(bookingStatus(none, TODAY)).toEqual({ text: "No price yet", tone: "plain", amount: null });
  });
});

describe("payments due", () => {
  it("says when a due is: late in rose, due within 14 days, or the long date", () => {
    expect(dueWhen("2026-10-10", TODAY)).toEqual({ text: "4 days late", late: true });
    expect(dueWhen("2026-10-18", TODAY)).toEqual({ text: "due in 4 days", late: false });
    expect(dueWhen("2026-10-30", TODAY)).toEqual({ text: "Friday 30 October", late: false });
  });

  it("writes the date card's day and short month, and nothing for a date that isn't real", () => {
    expect(dateCardParts("2026-10-30")).toEqual({ day: "30", month: "Oct" });
    expect(dateCardParts("2026-09-01")).toEqual({ day: "1", month: "Sep" });
    expect(dateCardParts("2026-02-30")).toBeNull();
  });

  it("adds who pays and the part's step after a full stop, but not a step that repeats the name", () => {
    const due = (over: Partial<Due["part"]>): Due => ({
      booking: decoration,
      part: { ...decoration.parts[1], ...over },
      left: 20_000_000,
      due: "2026-10-30",
      funder: "bella-fam",
      urgency: "later",
    });
    expect(dueTail(due({}), FUNDERS)).toBe(", paid by Bella’s family. Pay the balance");
    expect(dueTail(due({ step: "Final payment" }), FUNDERS)).toBe(", paid by Bella’s family");
    expect(dueTail(due({ step: "" }), FUNDERS)).toBe(", paid by Bella’s family");
    expect(dueTail({ ...due({}), funder: null }, FUNDERS)).toBe(", no funder yet. Pay the balance");
  });
});

describe("vendor rows", () => {
  it("writes the rating as a score and its reviews, or nothing before any review", () => {
    expect(ratingParts(4.8, 120)).toEqual({ score: "4,8", rest: "from 120 reviews" });
    expect(ratingParts(5, 1)).toEqual({ score: "5,0", rest: "from 1 review" });
    expect(ratingParts(3.9, 1200)).toEqual({ score: "3,9", rest: "from 1.200 reviews" });
    expect(ratingParts(null, 0)).toBeNull();
  });

  it("writes the meta line with the category only when the list isn't grouped by it, and keeps the height when empty", () => {
    expect(vendorMeta("Decoration", "Bu Ayu", true)).toBe("Decoration, Bu Ayu");
    expect(vendorMeta("Decoration", "Bu Ayu", false)).toBe("Bu Ayu");
    expect(vendorMeta("Decoration", null, false)).toBe(NO_TEXT);
  });
});

describe("what-if items", () => {
  it("says who would pay the item, with nobody yet for a part with no funder", () => {
    const single: WhatIfRecord & { category: string } = { id: "w1", name: "Second photographer", category: "Photography", totalPrice: 3_000_000, funder: "bella-fam" };
    expect(whatIfMeta(single, FUNDERS)).toBe("Photography, would be paid by Bella’s family");
    const nobody: WhatIfRecord & { category?: string | null } = { id: "w3", name: "Live band", totalPrice: 6_000_000, funder: null };
    expect(whatIfMeta(nobody, FUNDERS)).toBe("No category, would be paid by nobody yet");
    const parts: WhatIfRecord & { category: string } = {
      id: "w2",
      name: "Grand hall",
      category: "Venue",
      totalPrice: 0,
      funder: null,
      subEntries: [
        { id: "s1", name: "Sound", totalPrice: 4_000_000, funder: "greg" },
        { id: "s2", name: "Lighting", totalPrice: 6_000_000, funder: null },
        { id: "s3", name: "Hours", totalPrice: 2_500_000, funder: "ck" },
      ],
    };
    expect(whatIfMeta(parts, FUNDERS)).toBe("Venue, would be paid by 3 funders");
  });

  it("lists a what-if's parts with the price and who would pay, five at most", () => {
    const w: WhatIfRecord = {
      id: "w2",
      name: "Grand hall",
      totalPrice: 0,
      funder: null,
      subEntries: [
        { id: "s1", name: "Sound", totalPrice: 4_000_000, funder: "greg" },
        { id: "s2", name: "Chairs", totalPrice: 1_000_000 },
      ],
    };
    expect(whatIfPartLines(w, FUNDERS)).toEqual({
      lines: [
        { key: "s1", name: "Sound", value: "Rp 4.000.000, Greg", tone: "plain" },
        { key: "s2", name: "Chairs", value: "Rp 1.000.000, no funder yet", tone: "plain" },
      ],
      more: 0,
    });
    const many: WhatIfRecord = {
      id: "w4",
      name: "Many",
      totalPrice: 0,
      funder: null,
      subEntries: Array.from({ length: 7 }, (_, i) => ({ id: `m${i}`, name: `Part ${i}`, totalPrice: 1_000_000, funder: "ck" })),
    };
    const list = whatIfPartLines(many, FUNDERS);
    expect(list.lines).toHaveLength(5);
    expect(list.more).toBe(2);
  });
});

describe("documents", () => {
  it("shows the opening words, or Empty for a document with no words", () => {
    expect(extractText("", "")).toBe("Empty");
    expect(extractText("Short words", "")).toBe("Short words");
    expect(extractText("x".repeat(300), "")).toHaveLength(220);
  });

  it("with a search on, shows fifty characters before the first match and up to 120 after it", () => {
    const text = `${"a".repeat(100)}CONTRACT${"b".repeat(200)}`;
    const window = extractText(text, "contract");
    expect(window).toBe(`…${"a".repeat(50)}CONTRACT${"b".repeat(120)}`);
  });

  it("with a search that finds nothing, shows the opening words", () => {
    expect(extractText("hello world", "zzz")).toBe("hello world");
  });

  it("finds a match that only accents and capitals hide, so the window holds it (P4-S16)", () => {
    const text = `${"a".repeat(300)} Café Rosé ${"b".repeat(200)}`;
    const window = extractText(text, "cafe rose");
    expect(window).toContain("Café Rosé");
    expect(window.startsWith("…")).toBe(true);
  });
});

describe("files and folders", () => {
  it("names a path from the top folder down, or Files for the top", () => {
    expect(pathText([])).toBe("Files");
    expect(pathText(["Vendors", "Pelaminan Ayu"])).toBe("Vendors › Pelaminan Ayu");
  });

  it("gives the category, then the description, or the folder during a search", () => {
    expect(fileMeta({ category: "Contract", description: "Signed copy" }, [], false)).toEqual({
      category: "Contract",
      rest: "Signed copy",
    });
    expect(fileMeta({ category: "Invoice" }, ["Vendors", "Pelaminan Ayu"], true)).toEqual({
      category: "Invoice",
      rest: "in Vendors › Pelaminan Ayu",
    });
  });

  it("counts a folder's folders and files, or says Empty", () => {
    expect(folderMeta(6, 12)).toBe("6 folders, 12 files");
    expect(folderMeta(0, 1)).toBe("1 file");
    expect(folderMeta(0, 0)).toBe("Empty");
  });

  it("writes a file's size as the upload tiles do", () => {
    expect(fileSizeText(2_400_000)).toBe("2,3 MB");
    expect(fileSizeText(150_000)).toBe("146 KB");
  });
});
