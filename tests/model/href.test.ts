import { describe, expect, it } from "vitest";
import { safeNext, sectionOf, showsTopBar, veilHref } from "@/veil/href";
import { legacyHref } from "@/lib/legacy-href";

// Task 2.4; Task 7.1 moved the new UI to the root and the old one under /old.
describe("veilHref", () => {
  it("puts every path at the root", () => {
    expect(veilHref("/budget/bookings")).toBe("/budget/bookings");
    expect(veilHref("/sign-in")).toBe("/sign-in");
  });

  it("makes the root the overview", () => {
    expect(veilHref("/")).toBe("/");
  });
});

describe("legacyHref", () => {
  it("puts the old UI's paths under /old", () => {
    expect(legacyHref("/confirmed")).toBe("/old/confirmed");
    expect(legacyHref("/")).toBe("/old");
    expect(legacyHref("https://example.com")).toBe("https://example.com");
  });
});

// Phase 2 review: the address followed after sign-in.
describe("safeNext", () => {
  it("follows addresses inside the new UI", () => {
    expect(safeNext("/budget?x=1")).toBe("/budget?x=1");
    expect(safeNext("/")).toBe("/");
    expect(safeNext("/older")).toBe("/older");
  });

  it("sends anything else, the old UI included, to the overview", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext("/old")).toBe("/");
    expect(safeNext("/old/budget")).toBe("/");
    expect(safeNext("/old?x=1")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
  });

  it("refuses the backslash trick", () => {
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/%5Cevil.com")).toBe("/");
  });

  it("still works under a prefix, as it did at /new", () => {
    expect(safeNext("/new/budget?x=1", "/new")).toBe("/new/budget?x=1");
    expect(safeNext("/new", "/new")).toBe("/new");
    expect(safeNext("/newer", "/new")).toBe("/new");
    expect(safeNext("/old/budget", "/new")).toBe("/new");
    expect(safeNext("/new\\evil.com", "/new")).toBe("/new");
  });
});

// Phase 2 review S5: the shell draws the top bar, so it works out the section.
describe("sectionOf", () => {
  it("makes the root the overview and each section own its addresses", () => {
    expect(sectionOf("/")).toBe("overview");
    expect(sectionOf("/budget")).toBe("budget");
    expect(sectionOf("/budget/bookings/abc")).toBe("budget");
    expect(sectionOf("/vendors/shortlist")).toBe("vendors");
    expect(sectionOf("/schedule/tasks")).toBe("schedule");
    expect(sectionOf("/documents/files")).toBe("documents");
    expect(sectionOf("/items")).toBe("items");
    expect(sectionOf("/guests")).toBe("guests");
  });

  it("gives settings and unknown addresses no section", () => {
    expect(sectionOf("/settings")).toBeUndefined();
    expect(sectionOf("/budgets")).toBeUndefined();
    expect(sectionOf("/nowhere/budget")).toBeUndefined();
  });

  it("still works under a prefix", () => {
    expect(sectionOf("/new", "/new")).toBe("overview");
    expect(sectionOf("/new/budget/payments", "/new")).toBe("budget");
  });
});

describe("showsTopBar", () => {
  it("is on for screens, settings and missing pages", () => {
    expect(showsTopBar("/")).toBe(true);
    expect(showsTopBar("/budget/bookings")).toBe(true);
    expect(showsTopBar("/settings")).toBe(true);
    expect(showsTopBar("/nowhere")).toBe(true);
  });

  it("is off on sign-in and the gallery, which draws its own", () => {
    expect(showsTopBar("/sign-in")).toBe(false);
    expect(showsTopBar("/gallery")).toBe(false);
    expect(showsTopBar("/gallery/nav")).toBe(false);
    expect(showsTopBar("/new/sign-in", "/new")).toBe(false);
  });
});
