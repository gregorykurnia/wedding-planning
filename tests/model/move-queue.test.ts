import { describe, expect, it } from "vitest";
import { MoveQueue } from "@/lib/model/move-queue";

class Refused extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
const forget = (e: unknown) => !(e instanceof Refused) || e.code === "timeout" || e.code === "changed";

/** A write the test lands or fails by hand. */
function held<T>() {
  let land!: (v: T) => void;
  let fail!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    land = res;
    fail = rej;
  });
  return { promise, land, fail };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("MoveQueue", () => {
  it("starts each write from the positions the one before left", async () => {
    const q = new MoveQueue<string>(forget);
    const seen: string[] = [];
    const idle: boolean[] = [];
    void q.run(async (from) => (seen.push(from), "one"), () => "read", true, (f) => idle.push(f));
    await q.run(async (from) => (seen.push(from), "two"), () => "read", true, (f) => idle.push(f));
    expect(seen).toEqual(["read", "one"]);
    expect(q.positions).toBe("two");
    expect(idle).toEqual([false]);
    expect(q.read()).toBe(true);
    expect(q.positions).toBeNull();
  });

  // Phase 8 review S1: a read that arrives while a move runs used to be skipped, so the old positions
  // stayed after the queue went idle and every later move beside a partner's change was refused.
  it("drops the positions when the queue goes idle after a read arrived meanwhile", async () => {
    const q = new MoveQueue<string>(forget);
    const write = held<string>();
    const done = q.run(() => write.promise, () => "read", true, () => undefined);
    await tick();
    expect(q.read()).toBe(false);
    write.land("moved");
    await done;
    expect(q.positions).toBeNull();
  });

  it("drops the positions when a move is refused because the list changed", async () => {
    const q = new MoveQueue<string>(forget);
    await q.run(async () => "first", () => "read", true, () => undefined);
    expect(q.positions).toBe("first");
    const idle: boolean[] = [];
    await q.run(async () => Promise.reject(new Refused("changed")), () => "read", true, (f) => idle.push(f)).catch(() => undefined);
    expect(idle).toEqual([true]);
    expect(q.positions).toBeNull();
  });

  it("keeps the positions after a refusal that wrote nothing for another reason", async () => {
    const q = new MoveQueue<string>(forget);
    await q.run(async () => "first", () => "read", true, () => undefined);
    await q.run(async () => Promise.reject(new Refused("offline")), () => "read", true, () => undefined).catch(() => undefined);
    expect(q.positions).toBe("first");
  });

  it("tells idle that a move failed only once, and not for an add", async () => {
    const q = new MoveQueue<string>(forget);
    const idle: boolean[] = [];
    await q.run(async () => Promise.reject(new Refused("offline")), () => "read", false, (f) => idle.push(f)).catch(() => undefined);
    await q.run(async () => "ok", () => "read", true, (f) => idle.push(f));
    expect(idle).toEqual([false, false]);
  });
});
