import { describe, expect, it } from "vitest";
import { NAME_MISSING, directBookingDraft, nameProblem, type DirectBookingForm } from "@/lib/model/direct-booking";

// Task 4.7: what the add-a-booking form sends (guide §5.7). A blank category is
// Other, blank amounts are zero, "Not assigned" is no funder, and a due date
// that isn't a date is dropped.

const form = (over: Partial<DirectBookingForm> = {}): DirectBookingForm => ({
  name: "Wedding rings",
  category: "Other",
  price: 25_000_000,
  paid: 5_000_000,
  funder: "Bella",
  due: "2026-11-30",
  step: "Collect",
  files: [],
  ...over,
});

describe("nameProblem", () => {
  it("refuses a blank name, and says what to do about it", () => {
    expect(nameProblem("")).toBe(NAME_MISSING);
    expect(nameProblem("   ")).toBe(NAME_MISSING);
  });

  it("accepts a name", () => {
    expect(nameProblem("Wedding rings")).toBeNull();
  });
});

describe("directBookingDraft", () => {
  it("trims the name and the next step", () => {
    expect(directBookingDraft(form({ name: "  Wedding rings ", step: " Collect " }))).toMatchObject({
      name: "Wedding rings",
      step: "Collect",
    });
  });

  it("keeps the amounts, and a blank amount is zero", () => {
    expect(directBookingDraft(form({ price: 25_000_000, paid: null }))).toMatchObject({ price: 25_000_000, paid: 0 });
    expect(directBookingDraft(form({ price: null, paid: null }))).toMatchObject({ price: 0, paid: 0 });
  });

  it("files a category that wasn't chosen under Other", () => {
    expect(directBookingDraft(form({ category: "" })).category).toBe("Other");
    expect(directBookingDraft(form({ category: "Music" })).category).toBe("Music");
  });

  it("keeps the funder, and Not assigned is no funder", () => {
    expect(directBookingDraft(form({ funder: "Bella" })).funder).toBe("Bella");
    expect(directBookingDraft(form({ funder: null })).funder).toBeNull();
  });

  it("keeps a date that is a date, and drops a blank or invalid one", () => {
    expect(directBookingDraft(form({ due: "2026-11-30" })).due).toBe("2026-11-30");
    expect(directBookingDraft(form({ due: "" })).due).toBeNull();
    expect(directBookingDraft(form({ due: "30/11/2026" })).due).toBeNull();
  });

  it("passes the attached files on, in the order they were attached", () => {
    expect(directBookingDraft(form({ files: ["contract1", "receipt2"] })).files).toEqual(["contract1", "receipt2"]);
  });
});
