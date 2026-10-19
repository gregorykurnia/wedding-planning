import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_FAULTS, parseFaults } from "@/lib/data/dev-faults";

// Task 5.1: the dev-only faults that make a screen's "couldn't" states reachable.

describe("parseFaults", () => {
  it("reads one fault, or several separated by commas", () => {
    expect(parseFaults("load")).toEqual({ ...NO_FAULTS, load: true });
    expect(parseFaults("upload")).toEqual({ ...NO_FAULTS, upload: true });
    expect(parseFaults(" Save , LOAD ")).toEqual({ ...NO_FAULTS, save: "failed", load: true });
  });

  it("makes an offline device's writes fail as offline, unless a failure is named", () => {
    expect(parseFaults("offline")).toEqual({ ...NO_FAULTS, offline: true, save: "offline" });
    expect(parseFaults("offline,save:timeout")).toEqual({ ...NO_FAULTS, offline: true, save: "timeout" });
    expect(parseFaults("save:timeout,offline").save).toBe("timeout");
  });

  it("takes the kind of write failure after a colon, and falls back to failed", () => {
    expect(parseFaults("save:timeout").save).toBe("timeout");
    expect(parseFaults("save:denied").save).toBe("denied");
    expect(parseFaults("save:nonsense").save).toBe("failed");
  });

  it("ignores what it doesn't know, and `off` or nothing is no faults", () => {
    expect(parseFaults("explode,load:7")).toEqual({ ...NO_FAULTS, load: true });
    expect(parseFaults("off")).toEqual(NO_FAULTS);
    expect(parseFaults("")).toEqual(NO_FAULTS);
    expect(parseFaults(null)).toEqual(NO_FAULTS);
  });
});

/** A browser with `?fault=` in its address and a place to keep it for the tab. */
function browser(search: string) {
  const store = new Map<string, string>();
  vi.stubGlobal("window", { location: { search } });
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return { store, go: (next: string) => ((window as unknown as { location: { search: string } }).location.search = next) };
}

describe("with the dev flag on", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_VEIL_DEV", "1");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps the faults for the tab when a move between screens drops the query, until `off`", async () => {
    const { go } = browser("?fault=load,save:timeout");
    const { devFaults } = await import("@/lib/data/dev-faults");
    expect(devFaults()).toMatchObject({ load: true, save: "timeout" });
    go("");
    expect(devFaults()).toMatchObject({ load: true, save: "timeout" });
    go("?fault=off");
    expect(devFaults()).toEqual(NO_FAULTS);
    go("");
    expect(devFaults()).toEqual(NO_FAULTS);
  });

  it("makes every write fail at once with the asked failure, nothing run, and Try again fails too", async () => {
    browser("?fault=save:denied");
    const { guarded } = await import("@/lib/data/write");
    const run = vi.fn(async () => "written");
    const failure = await guarded(run).catch((e) => e);
    expect(failure).toMatchObject({ name: "WriteError", code: "denied" });
    await expect(failure.retry()).rejects.toMatchObject({ code: "denied" });
    expect(run).not.toHaveBeenCalled();
  });

  it("makes a read fail before any data, and leaves demonstration mode as it was", async () => {
    browser("?fault=load");
    const { readOf } = await import("@/lib/data/read");
    expect(readOf("online", [{ loading: false, error: null }], [1, 2])).toEqual({ status: "error", data: null });
    expect(readOf("demo", [], [1, 2])).toEqual({ status: "demo", data: null });
  });
});

describe("with the dev flag off", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("ignores ?fault= entirely", async () => {
    vi.resetModules();
    browser("?fault=save,load,offline,upload");
    const { devFaults } = await import("@/lib/data/dev-faults");
    const { guarded } = await import("@/lib/data/write");
    const { readOf } = await import("@/lib/data/read");
    expect(devFaults()).toEqual(NO_FAULTS);
    await expect(guarded(async () => "written")).resolves.toBe("written");
    expect(readOf("online", [{ loading: false, error: null }], [1])).toEqual({ status: "ready", data: [1] });
  });
});
