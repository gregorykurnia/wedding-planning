import { describe, expect, it } from "vitest";
import { Tries } from "@/lib/model/tries";

// Phase 5 review S19: an item's text edited twice keeps the second while it saves.
describe("Tries", () => {
  it("lets a field go only when its newest try lands", () => {
    const tries = new Tries();
    const first = tries.start("a:item");
    const second = tries.start("a:item");
    expect(tries.settle("a:item", first)).toBe(false);
    expect(tries.settle("a:item", second)).toBe(true);
  });

  it("keeps a failed newer try held when the older one lands after it", () => {
    const tries = new Tries();
    const first = tries.start("a:item");
    const second = tries.start("a:item");
    // The second failed (nothing settles); the first lands late.
    expect(tries.settle("a:item", first)).toBe(false);
    // Try again on the second lands.
    expect(tries.settle("a:item", second)).toBe(true);
  });

  it("doesn't show an older try's failure once a newer one has started", () => {
    const tries = new Tries();
    const first = tries.start("a:item");
    expect(tries.newest("a:item", first)).toBe(true);
    const second = tries.start("a:item");
    expect(tries.newest("a:item", first)).toBe(false);
    tries.settle("a:item", second);
    expect(tries.newest("a:item", first)).toBe(false);
  });

  it("counts each field on its own", () => {
    const tries = new Tries();
    const name = tries.start("a:item");
    const vendor = tries.start("a:vendor");
    expect(tries.settle("a:vendor", vendor)).toBe(true);
    expect(tries.settle("a:item", name)).toBe(true);
  });

  // Phase 6 review S9: name A fails, B is typed, then A's Try again is pressed.
  it("an older try's Try again writes nothing once a newer try has started", async () => {
    const tries = new Tries();
    const stored: string[] = [];
    let retryA: (() => void) | null = null;
    let failA = true;
    const write = (text: string) => async () => {
      if (text === "A" && failA) throw new Error("offline");
      stored.push(text);
    };
    tries.run("a:item", write("A"), { landed: () => undefined, failed: (retry) => (retryA = retry) });
    await Promise.resolve();
    await Promise.resolve();
    expect(retryA).not.toBeNull();
    let landedB = false;
    tries.run("a:item", write("B"), { landed: () => (landedB = true), failed: () => undefined });
    failA = false;
    retryA!();
    await new Promise((r) => setTimeout(r, 0));
    expect(landedB).toBe(true);
    expect(stored).toEqual(["B"]);
  });

  it("Try again on the newest try runs, and lets the field go when it lands", async () => {
    const tries = new Tries();
    let fail = true;
    let retry: (() => void) | null = null;
    let landed = false;
    tries.run("a:item", async () => {
      if (fail) throw new Error("offline");
    }, { landed: () => (landed = true), failed: (r) => (retry = r) });
    await new Promise((r) => setTimeout(r, 0));
    fail = false;
    retry!();
    await new Promise((r) => setTimeout(r, 0));
    expect(landed).toBe(true);
  });
});
