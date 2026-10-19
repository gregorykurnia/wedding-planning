import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REPROBE_MS, watchReprobe } from "@/lib/data/reprobe";

// Review P2-S1: an account let in on trust is probed again on a timer and when
// the page shows, not only when the browser's online flag changes.

function fakes(visibility: DocumentVisibilityState = "visible") {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: visibility });
  return { win, doc, targets: { window: win, document: doc } as never };
}

describe("watchReprobe", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("asks again on a timer while the page shows, with the browser still online", () => {
    const probe = vi.fn();
    const { targets } = fakes();
    const stop = watchReprobe(probe, targets);
    vi.advanceTimersByTime(REPROBE_MS);
    expect(probe).toHaveBeenCalledTimes(1);
    stop();
  });

  it("doesn't ask on the timer while the page is hidden, and asks when it shows", () => {
    const probe = vi.fn();
    const { doc, targets } = fakes("hidden");
    const stop = watchReprobe(probe, targets);
    vi.advanceTimersByTime(REPROBE_MS * 3);
    expect(probe).not.toHaveBeenCalled();
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(probe).toHaveBeenCalledTimes(1);
    stop();
  });

  it("asks when the device comes back online, and stops when told", () => {
    const probe = vi.fn();
    const { win, targets } = fakes();
    const stop = watchReprobe(probe, targets);
    win.dispatchEvent(new Event("online"));
    expect(probe).toHaveBeenCalledTimes(1);
    stop();
    win.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(REPROBE_MS * 2);
    expect(probe).toHaveBeenCalledTimes(1);
  });
});
