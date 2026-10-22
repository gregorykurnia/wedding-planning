import { beforeEach, describe, expect, it } from "vitest";
import { forgetSynced, readAnswer, type Answer } from "@/lib/collection-answers";

// P7-S14: which snapshots a live collection read believes.
const first = (over: Partial<Answer> = {}): Answer => ({
  name: "weddingFiles",
  arrived: false,
  fromCache: true,
  empty: true,
  changed: false,
  online: false,
  ...over,
});

beforeEach(forgetSynced);

describe("a read's first answer", () => {
  it("holds an empty answer from the cache while offline, before the server has answered", () => {
    expect(readAnswer(first())).toBe("hold");
  });

  it("believes it once the server has answered for that collection this session (a couple with no files)", () => {
    readAnswer(first({ fromCache: false, online: true }));
    expect(readAnswer(first())).toBe("take");
    // Only that collection: another one's empty cache still says nothing has arrived.
    expect(readAnswer(first({ name: "shortlist" }))).toBe("hold");
  });

  it("takes what the cache holds, and anything online", () => {
    expect(readAnswer(first({ empty: false }))).toBe("take");
    expect(readAnswer(first({ online: true }))).toBe("take");
  });

  it("is released by the server's own answer, even an empty one (the hook no longer releases on the online event)", () => {
    expect(readAnswer(first())).toBe("hold");
    expect(readAnswer(first({ fromCache: false, online: true }))).toBe("take");
  });
});

describe("later answers", () => {
  it("skips one where only the metadata moved, and takes one with a change", () => {
    expect(readAnswer(first({ arrived: true, fromCache: false }))).toBe("skip");
    expect(readAnswer(first({ arrived: true, changed: true }))).toBe("take");
  });
});
