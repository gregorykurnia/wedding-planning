import { describe, expect, it } from "vitest";
import { mergeStatus, readOf } from "@/lib/data/read";
import type { Loaded } from "@/lib/data/settings";

const idle = { loading: false, error: null };

describe("readOf", () => {
  it("has no data at all in demonstration mode", () => {
    expect(readOf("demo", [idle], 5)).toEqual({ status: "demo", data: null });
  });
  it("keeps what has arrived through an error or being offline", () => {
    expect(readOf("online", [idle, { loading: false, error: "denied" }], 5)).toEqual({ status: "error", data: 5 });
    expect(readOf("offline", [idle], 5)).toEqual({ status: "offline", data: 5 });
    // A read that is still waiting has brought nothing, so there is nothing to keep.
    expect(readOf("offline", [idle, { loading: true, error: null }], 5)).toEqual({ status: "offline", data: null });
  });
  it("has no data when a read failed before its first answer, so the screen says it didn't load (Phase 5 review)", () => {
    expect(readOf("online", [idle, { loading: false, error: "denied", arrived: false }], 5)).toEqual({ status: "error", data: null });
    expect(readOf("online", [{ loading: false, error: "denied", arrived: true }], 5)).toEqual({ status: "error", data: 5 });
  });
  it("is loading, with no data, until every source has answered", () => {
    expect(readOf("online", [idle, { loading: true, error: null }], 5)).toEqual({ status: "loading", data: null });
    expect(readOf("online", [idle, idle], 5)).toEqual({ status: "ready", data: 5 });
  });
});

describe("mergeStatus", () => {
  const read = (status: Loaded<number>["status"]): Loaded<number> => ({ status, data: null });
  it("takes the worst status", () => {
    expect(mergeStatus(read("ready"), read("loading"))).toBe("loading");
    expect(mergeStatus(read("loading"), read("offline"))).toBe("offline");
    expect(mergeStatus(read("offline"), read("error"))).toBe("error");
    expect(mergeStatus(read("error"), read("demo"))).toBe("demo");
    expect(mergeStatus(read("ready"), read("ready"))).toBe("ready");
  });
});
