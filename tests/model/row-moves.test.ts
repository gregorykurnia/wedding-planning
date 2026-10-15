import { describe, expect, it } from "vitest";
import { dropEdge, dropId, moveId } from "@/lib/model/row-moves";

const ids = ["a", "b", "c", "d"];

describe("moveId", () => {
  it("moves a row one place up or down", () => {
    expect(moveId(ids, "c", -1)).toEqual(["a", "c", "b", "d"]);
    expect(moveId(ids, "b", 1)).toEqual(["a", "c", "b", "d"]);
  });

  it("does nothing past either end, or for a row that isn't there", () => {
    expect(moveId(ids, "a", -1)).toBeNull();
    expect(moveId(ids, "d", 1)).toBeNull();
    expect(moveId(ids, "x", 1)).toBeNull();
  });

  it("leaves the list it was given alone", () => {
    moveId(ids, "b", 1);
    expect(ids).toEqual(["a", "b", "c", "d"]);
  });
});

describe("dropId", () => {
  it("drops a row above or below the row it lands on", () => {
    expect(dropId(ids, "d", "b", "above")).toEqual(["a", "d", "b", "c"]);
    expect(dropId(ids, "a", "c", "below")).toEqual(["b", "c", "a", "d"]);
    expect(dropId(ids, "a", "c", "above")).toEqual(["b", "a", "c", "d"]);
  });

  it("says nothing moves when the row would stay where it is", () => {
    expect(dropId(ids, "b", "b", "above")).toBeNull();
    expect(dropId(ids, "b", "c", "above")).toBeNull();
    expect(dropId(ids, "c", "b", "below")).toBeNull();
  });

  it("ignores a row or a target that isn't in the list", () => {
    expect(dropId(ids, "x", "b", "above")).toBeNull();
    expect(dropId(ids, "a", "x", "below")).toBeNull();
  });
});

describe("dropEdge", () => {
  it("is above in the top half of a row and below in the bottom half", () => {
    expect(dropEdge(5, 40)).toBe("above");
    expect(dropEdge(19.9, 40)).toBe("above");
    expect(dropEdge(20, 40)).toBe("below");
    expect(dropEdge(39, 40)).toBe("below");
  });
});
