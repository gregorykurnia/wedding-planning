import { describe, expect, it } from "vitest";
import { fieldFailure, FIELD_FAILED, SAVE_DEMO } from "@/lib/model/save-state";
import { SheetHolds } from "@/lib/model/sheet-holds";

// Review P3-S2 and P3-S6: a sheet stays busy while any of its writes is in
// flight, and the host hears when the last one lets go.

describe("SheetHolds", () => {
  it("stays busy until every holder has let go (review P3-S2)", () => {
    const holds = new SheetHolds();
    const fieldSave = holds.hold(1);
    const removal = holds.hold(1);
    fieldSave();
    expect(holds.busy(1)).toBe(true);
    removal();
    expect(holds.busy(1)).toBe(false);
  });

  it("ignores a second release, so one holder can't free another's hold", () => {
    const holds = new SheetHolds();
    const first = holds.hold(1);
    holds.hold(1);
    first();
    first();
    expect(holds.busy(1)).toBe(true);
  });

  it("keeps each sheet's holds apart", () => {
    const holds = new SheetHolds();
    holds.hold(1);
    expect(holds.busy(2)).toBe(false);
  });

  it("says when the last hold goes, once, so a sheet left on another screen can close then (review P3-S6)", () => {
    const holds = new SheetHolds();
    const a = holds.hold(7);
    const b = holds.hold(7);
    expect(a()).toBe(false);
    expect(b()).toBe(true);
    expect(b()).toBe(false);
  });

  it("drops a closed sheet's holds, and a late release says nothing", () => {
    const holds = new SheetHolds();
    const release = holds.hold(3);
    holds.clear(3);
    expect(holds.busy(3)).toBe(false);
    expect(release()).toBe(false);
  });
});

describe("fieldFailure (review P3-S5, InlineRename)", () => {
  it("says demonstration mode can't save, with no Try again", () => {
    expect(fieldFailure("demo")).toEqual({ text: SAVE_DEMO, retry: false });
    expect(fieldFailure("offline")).toEqual({ text: FIELD_FAILED, retry: true });
    expect(fieldFailure()).toEqual({ text: FIELD_FAILED, retry: true });
  });
});
