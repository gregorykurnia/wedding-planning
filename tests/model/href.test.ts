import { describe, expect, it } from "vitest";
import { safeNext, sectionOf, showsTopBar, veilHref } from "@/veil/href";

// Task 2.4. Task 7.1 moves the new UI to the root and changes these to "/" and "/budget".
describe("veilHref", () => {
  it("puts every path under /new", () => {
    expect(veilHref("/budget/bookings")).toBe("/new/budget/bookings");
    expect(veilHref("/sign-in")).toBe("/new/sign-in");
  });

  it("makes the root the overview", () => {
    expect(veilHref("/")).toBe("/new");
  });
});

// Phase 2 review: the address followed after sign-in, now and after Task 7.1.
describe("safeNext", () => {
  it("follows addresses inside the new UI", () => {
    expect(safeNext("/new/budget?x=1")).toBe("/new/budget?x=1");
    expect(safeNext("/new")).toBe("/new");
    expect(safeNext("/budget", "")).toBe("/budget");
  });

  it("sends anything else to the overview", () => {
    expect(safeNext(null)).toBe("/new");
    expect(safeNext("/old/budget")).toBe("/new");
    expect(safeNext("/newer")).toBe("/new");
    expect(safeNext("//evil.com")).toBe("/new");
    expect(safeNext("/new\\evil.com")).toBe("/new");
    expect(safeNext("https://evil.com/new")).toBe("/new");
  });

  it("refuses the backslash trick once the new UI is at the root", () => {
    expect(safeNext("/\\evil.com", "")).toBe("/");
    expect(safeNext("//evil.com", "")).toBe("/");
    expect(safeNext("/%5Cevil.com", "")).toBe("/");
    expect(safeNext("https://evil.com", "")).toBe("/");
  });
});

// Phase 2 review S5: the shell draws the top bar, so it works out the section.
describe("sectionOf", () => {
  it("makes the root the overview and each section own its addresses", () => {
    expect(sectionOf("/new")).toBe("overview");
    expect(sectionOf("/new/budget")).toBe("budget");
    expect(sectionOf("/new/budget/bookings/abc")).toBe("budget");
    expect(sectionOf("/new/vendors/shortlist")).toBe("vendors");
    expect(sectionOf("/new/schedule/tasks")).toBe("schedule");
    expect(sectionOf("/new/documents/files")).toBe("documents");
    expect(sectionOf("/new/items")).toBe("items");
    expect(sectionOf("/new/guests")).toBe("guests");
  });

  it("gives settings and unknown addresses no section", () => {
    expect(sectionOf("/new/settings")).toBeUndefined();
    expect(sectionOf("/new/budgets")).toBeUndefined();
    expect(sectionOf("/new/nowhere/budget")).toBeUndefined();
  });

  it("works at the root once Task 7.1 empties the prefix", () => {
    expect(sectionOf("/", "")).toBe("overview");
    expect(sectionOf("/budget/payments", "")).toBe("budget");
    expect(sectionOf("/settings", "")).toBeUndefined();
  });
});

describe("showsTopBar", () => {
  it("is on for screens, settings and missing pages", () => {
    expect(showsTopBar("/new")).toBe(true);
    expect(showsTopBar("/new/budget/bookings")).toBe(true);
    expect(showsTopBar("/new/settings")).toBe(true);
    expect(showsTopBar("/new/nowhere")).toBe(true);
  });

  it("is off on sign-in and the gallery, which draws its own", () => {
    expect(showsTopBar("/new/sign-in")).toBe(false);
    expect(showsTopBar("/new/gallery")).toBe(false);
    expect(showsTopBar("/new/gallery/nav")).toBe(false);
    expect(showsTopBar("/sign-in", "")).toBe(false);
    expect(showsTopBar("/", "")).toBe(true);
  });
});
