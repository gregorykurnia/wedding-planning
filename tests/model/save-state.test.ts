import { describe, expect, it } from "vitest";
import {
  draftOf,
  fieldReducer,
  initialField,
  notSaved,
  saveLine,
  type FieldAction,
  type FieldState,
} from "@/lib/model/save-state";

// Task 3.4: the words of the save line and the state machine behind one field.

describe("saveLine", () => {
  it("says every change saves when nothing has happened", () => {
    expect(saveLine([])).toEqual({ kind: "idle", failed: 0, text: "Every change saves as you go" });
    expect(saveLine(["idle", "idle"]).kind).toBe("idle");
  });

  it("follows Saving then Saved", () => {
    expect(saveLine(["saving"]).text).toBe("Saving");
    expect(saveLine(["saved"]).text).toBe("Saved");
    expect(saveLine(["saved", "idle"]).text).toBe("Saved");
  });

  it("keeps Saving up while any field is still saving", () => {
    expect(saveLine(["saved", "saving"]).text).toBe("Saving");
  });

  it("counts the changes that didn't save, and a failure beats saving and saved", () => {
    expect(saveLine(["failed"]).text).toBe("1 change not saved");
    expect(saveLine(["failed", "saving", "saved", "failed"])).toEqual({
      kind: "failed",
      failed: 2,
      text: "2 changes not saved",
    });
    expect(notSaved(1)).toBe("1 change not saved");
  });

  it("says nothing is saved in demonstration mode, whatever the fields report", () => {
    expect(saveLine([], true).text).toBe("Demonstration mode: changes aren’t saved");
    expect(saveLine(["failed", "saving"], true).kind).toBe("demo");
  });
});

describe("one field", () => {
  const reduce = fieldReducer<string>(Object.is);
  const run = (actions: FieldAction<string>[], from: FieldState<string> = initialField<string>()) =>
    actions.reduce(reduce, from);

  it("shows the saved value until something is typed", () => {
    expect(draftOf(initialField<string>(), "Bella", Object.is)).toBe("Bella");
  });

  it("shows what is typed, while it is typed and while it saves", () => {
    const typed = run([{ type: "type", value: "Isabella" }]);
    expect(draftOf(typed, "Bella", Object.is)).toBe("Isabella");
    const saving = run([{ type: "save", value: "Isabella" }]);
    expect(saving.status).toBe("saving");
    expect(draftOf(saving, "Bella", Object.is)).toBe("Isabella");
  });

  it("goes back to the saved value once the write is confirmed and the value has arrived", () => {
    const done = run([
      { type: "save", value: "Isabella" },
      { type: "saved", value: "Isabella", current: "Isabella" },
    ]);
    expect(done.status).toBe("saved");
    expect(done.pending).toBeNull();
    // From here a change by the partner shows through.
    expect(draftOf(done, "Izzy", Object.is)).toBe("Izzy");
  });

  it("keeps showing what was typed after confirmation until the saved value changes", () => {
    const done = run([
      { type: "save", value: "Isabella" },
      { type: "saved", value: "Isabella", current: "Bella" },
    ]);
    expect(draftOf(done, "Bella", Object.is)).toBe("Isabella");
    expect(draftOf(done, "Isabella", Object.is)).toBe("Isabella");
    expect(draftOf(done, "Izzy", Object.is)).toBe("Izzy");
  });

  it("keeps text typed after Enter while that save ran", () => {
    const done = run([
      { type: "type", value: "abc" },
      { type: "save", value: "abc" },
      { type: "type", value: "abcdef" },
      { type: "saved", value: "abc", current: "abc" },
    ]);
    expect(done.status).toBe("saved");
    expect(draftOf(done, "abc", Object.is)).toBe("abcdef");
    // A partner's later change doesn't wipe it either: it's still unsaved typing.
    expect(draftOf(done, "Izzy", Object.is)).toBe("abcdef");
  });

  it("keeps the typed value and the attempt when a save fails", () => {
    const failed = run([{ type: "save", value: "Isabella" }, { type: "failed" }]);
    expect(failed.status).toBe("failed");
    expect(draftOf(failed, "Bella", Object.is)).toBe("Isabella");
    expect(failed.attempt).toEqual({ value: "Isabella" });
  });

  it("returns to idle, showing the saved value, when reverted", () => {
    const failed = run([{ type: "save", value: "" }, { type: "failed" }]);
    const reverted = run([{ type: "revert" }], failed);
    expect(reverted).toEqual(initialField<string>());
    expect(draftOf(reverted, "Bella", Object.is)).toBe("Bella");
  });

  it("compares with the equality it is given", () => {
    const sameDay = fieldReducer<string>((a, b) => a.slice(0, 10) === b.slice(0, 10));
    const done = [{ type: "save", value: "2027-06-12" }, { type: "saved", value: "2027-06-12", current: "2027-06-12T00:00" }].reduce(
      (state, action) => sameDay(state, action as FieldAction<string>),
      initialField<string>(),
    );
    expect(done.pending).toBeNull();
  });
});
