import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_PAUSE_MS, DocSaver } from "@/veil/editor/doc-saver";

// Task 4.17: the document autosave (guide §4.24, §6.1, R5). The risk is lost
// writing, so these follow every way a change can fail to land.

type Draft = { text: string };

class Offline extends Error {}

function setup({ savedAt = null as number | null } = {}) {
  const saved: string[] = [];
  let fail: Error | null = null;
  let hold: Promise<void> | null = null;
  const saver = new DocSaver<Draft>({
    save: async (draft) => {
      if (hold) await hold;
      if (fail) throw fail;
      saved.push(draft.text);
    },
    isOffline: (err) => err instanceof Offline,
    now: () => 1_000,
    savedAt,
  });
  const kinds: string[] = [];
  saver.subscribe(() => kinds.push(saver.state.kind));
  return {
    saver,
    saved,
    kinds,
    failWith: (err: Error | null) => (fail = err),
    holdUntil: () => {
      let release = () => {};
      hold = new Promise<void>((r) => (release = r));
      return () => {
        hold = null;
        release();
      };
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DocSaver", () => {
  it("starts saved, says Not saved yet on a change, then saves after a 0.9 s pause", async () => {
    const { saver, saved, kinds } = setup({ savedAt: 500 });
    expect(saver.state).toEqual({ kind: "saved", savedAt: 500 });
    saver.change({ text: "a" });
    expect(saver.state.kind).toBe("unsaved");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_PAUSE_MS - 1);
    expect(saved).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saved).toEqual(["a"]);
    expect(kinds).toEqual(["unsaved", "saving", "saved"]);
    expect(saver.state).toEqual({ kind: "saved", savedAt: 1_000 });
    expect(saver.hasUnsaved).toBe(false);
  });

  it("waits for a pause: typing keeps pushing the save back, and only the newest draft is written", async () => {
    const { saver, saved } = setup();
    saver.change({ text: "a" });
    await vi.advanceTimersByTimeAsync(600);
    saver.change({ text: "ab" });
    await vi.advanceTimersByTimeAsync(600);
    saver.change({ text: "abc" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_PAUSE_MS);
    expect(saved).toEqual(["abc"]);
  });

  it("a change made while a save is in flight is saved after it, never lost", async () => {
    const { saver, saved, holdUntil } = setup();
    const release = holdUntil();
    saver.change({ text: "first" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_PAUSE_MS);
    expect(saver.state.kind).toBe("saving");
    saver.change({ text: "second" });
    expect(saver.state.kind).toBe("unsaved");
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(saved).toEqual(["first"]);
    expect(saver.state.kind).toBe("unsaved");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_PAUSE_MS);
    expect(saved).toEqual(["first", "second"]);
    expect(saver.state.kind).toBe("saved");
  });

  it("a failed save keeps the draft and says Couldn't save; Try again writes it", async () => {
    const { saver, saved, failWith } = setup();
    failWith(new Error("timeout"));
    saver.change({ text: "kept" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_PAUSE_MS);
    expect(saver.state.kind).toBe("failed");
    expect(saver.unsavedDraft).toEqual({ text: "kept" });
    // Not retried on its own.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(saved).toEqual([]);
    failWith(null);
    expect(await saver.retry()).toBe(true);
    expect(saved).toEqual(["kept"]);
    expect(saver.state.kind).toBe("saved");
  });

  it("says offline when the failure is the connection, and the next change tries again", async () => {
    const { saver, saved, failWith } = setup();
    failWith(new Offline());
    saver.change({ text: "a" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_PAUSE_MS);
    expect(saver.state.kind).toBe("offline");
    failWith(null);
    saver.change({ text: "ab" });
    expect(saver.state.kind).toBe("unsaved");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_PAUSE_MS);
    expect(saved).toEqual(["ab"]);
  });

  it("flush saves at once and resolves true when it lands, false when it fails", async () => {
    const { saver, saved, failWith } = setup();
    saver.change({ text: "a" });
    expect(await saver.flush()).toBe(true);
    expect(saved).toEqual(["a"]);
    // The pause timer was cleared: nothing saves twice.
    await vi.advanceTimersByTimeAsync(AUTOSAVE_PAUSE_MS);
    expect(saved).toEqual(["a"]);

    failWith(new Error("denied"));
    saver.change({ text: "b" });
    expect(await saver.flush()).toBe(false);
    expect(saver.hasUnsaved).toBe(true);
  });

  it("flush with nothing to save says whether everything has landed", async () => {
    const { saver, failWith } = setup();
    expect(await saver.flush()).toBe(true);
    failWith(new Error("x"));
    saver.change({ text: "a" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_PAUSE_MS);
    failWith(null);
    // Two presses of Try again at once write once.
    const [one, two] = await Promise.all([saver.retry(), saver.retry()]);
    expect([one, two]).toEqual([true, true]);
  });

  it("flush during a save waits for it, then saves the newer change", async () => {
    const { saver, saved, holdUntil } = setup();
    const release = holdUntil();
    saver.change({ text: "a" });
    const first = saver.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(saver.state.kind).toBe("saving");
    saver.change({ text: "ab" });
    const second = saver.flush();
    release();
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(saved).toEqual(["a", "ab"]);
  });

  it("still saves what's left after dispose (leaving the screen), without telling the gone screen", async () => {
    const { saver, saved, kinds } = setup();
    saver.change({ text: "left" });
    const before = kinds.length;
    saver.dispose();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_PAUSE_MS);
    expect(saved).toEqual([]);
    expect(await saver.flush()).toBe(true);
    expect(saved).toEqual(["left"]);
    expect(kinds.length).toBe(before);
  });

  it("abandon forgets the unsaved change: leaving without it, or a deleted document", async () => {
    const { saver, saved } = setup();
    saver.change({ text: "dropped" });
    saver.abandon();
    expect(saver.hasUnsaved).toBe(false);
    await vi.advanceTimersByTimeAsync(AUTOSAVE_PAUSE_MS);
    await saver.flush();
    expect(saved).toEqual([]);
  });

  it("revive puts a disposed saver back in use (React mounts effects twice in development)", async () => {
    const { saver, saved } = setup();
    saver.dispose();
    saver.revive();
    saver.change({ text: "a" });
    await vi.advanceTimersByTimeAsync(AUTOSAVE_PAUSE_MS);
    expect(saved).toEqual(["a"]);
  });
});
