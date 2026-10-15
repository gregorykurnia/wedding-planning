import { describe, expect, it } from "vitest";
import { veilHref } from "@/veil/href";

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
