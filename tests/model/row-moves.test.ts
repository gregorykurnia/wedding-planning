import { describe, expect, it } from "vitest";
import { MIN_SORT_GAP, dropEdge, dropId, moveId, neighboursOf, positionsBetween } from "@/lib/model/row-moves";

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

describe("positionsBetween", () => {
  it("spreads the new rows evenly between two neighbours", () => {
    expect(positionsBetween(1, 2)).toEqual([1.5]);
    expect(positionsBetween(0, 4, 3)).toEqual([1, 2, 3]);
  });

  it("goes one step past either end of the list, or starts at 0 in an empty one", () => {
    expect(positionsBetween(null, 5)).toEqual([4]);
    expect(positionsBetween(null, 5, 3)).toEqual([2, 3, 4]);
    expect(positionsBetween(7, null, 2)).toEqual([8, 9]);
    expect(positionsBetween(null, null, 3)).toEqual([0, 1, 2]);
  });

  it("says when the gap has run out, so the list has to be renumbered first", () => {
    expect(positionsBetween(1, 1)).toBeNull();
    expect(positionsBetween(1, 1 + MIN_SORT_GAP)).toBeNull();
    expect(positionsBetween(1, 1 + MIN_SORT_GAP * 4)).not.toBeNull();
    expect(positionsBetween(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBeNull();
  });

  it("halves the gap each time a row goes in at the same place", () => {
    let low = 0;
    const high = 1;
    let inserts = 0;
    for (;;) {
      const at = positionsBetween(low, high);
      if (!at) break;
      low = at[0];
      inserts++;
    }
    expect(inserts).toBeGreaterThan(15);
    expect(inserts).toBeLessThan(25);
  });
});

describe("neighboursOf", () => {
  const ids = ["a", "b", "c"];

  it("names the row above and the row below", () => {
    expect(neighboursOf(ids, "b")).toEqual({ above: "a", below: "c" });
  });

  it("has none above the first row or below the last", () => {
    expect(neighboursOf(ids, "a")).toEqual({ above: null, below: "b" });
    expect(neighboursOf(ids, "c")).toEqual({ above: "b", below: null });
    expect(neighboursOf(["a"], "a")).toEqual({ above: null, below: null });
    expect(neighboursOf(ids, "x")).toEqual({ above: null, below: null });
  });
});
