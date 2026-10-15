import { describe, expect, it } from "vitest";
import { safeNext, veilHref } from "@/veil/href";

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
