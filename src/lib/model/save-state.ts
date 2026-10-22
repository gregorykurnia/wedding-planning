/**
 * What a screen's save line says (guide §4.9, §6.1). Every field on a screen
 * reports where its own save stands; the line sums them up. Pure, so the words
 * are tested without a browser.
 */

export type FieldStatus = "idle" | "saving" | "saved" | "failed";

export type SaveLineKind = "idle" | "saving" | "saved" | "failed" | "demo";

export interface SaveLine {
  kind: SaveLineKind;
  /** How many fields have a change that didn't save. */
  failed: number;
  text: string;
}

export const SAVE_IDLE = "Every change saves as you go";
export const SAVE_DEMO = "Demonstration mode: changes aren’t saved";

/** "1 change not saved", "3 changes not saved". */
export const notSaved = (count: number) => `${count} ${count === 1 ? "change" : "changes"} not saved`;

/**
 * Failed beats saving beats saved beats idle: a screen with one change that
 * didn't land must say so while another is still saving. Demonstration mode
 * overrides all of them, since nothing is ever saved there.
 */
export function saveLine(statuses: Iterable<FieldStatus>, demo = false): SaveLine {
  if (demo) return { kind: "demo", failed: 0, text: SAVE_DEMO };
  let failed = 0;
  let saving = false;
  let saved = false;
  for (const status of statuses) {
    if (status === "failed") failed += 1;
    else if (status === "saving") saving = true;
    else if (status === "saved") saved = true;
  }
  if (failed) return { kind: "failed", failed, text: notSaved(failed) };
  if (saving) return { kind: "saving", failed: 0, text: "Saving" };
  if (saved) return { kind: "saved", failed: 0, text: "Saved" };
  return { kind: "idle", failed: 0, text: SAVE_IDLE };
}

/** The words under a field whose change didn't save, before its Try again (guide §4.9). */
export const FIELD_FAILED = "Couldn’t save this change. What you typed is kept.";

/**
 * What a field that wrote on its own says when the write was refused, from the
 * `WriteError` code: demonstration mode can't save, so it says so and offers
 * no Try again.
 */
export function fieldFailure(code?: string): { text: string; retry: boolean } {
  return code === "demo" ? { text: SAVE_DEMO, retry: false } : { text: FIELD_FAILED, retry: true };
}

/**
 * A save that failed while the device is offline says so instead (guide §6.5),
 * as a document's save line does; the Try again after it stays.
 */
export const SAVE_OFFLINE = "Not saved: you’re offline. Keep this page open.";
export const offlineOr = (text: string, offline: boolean) => (offline ? SAVE_OFFLINE : text);

/** The same failure in a sheet's save line, which covers every field in the sheet (guide §6.1). */
export const SHEET_FAILED = "Couldn’t save. What you typed is kept.";

// ---------- one field ----------

/**
 * Where one field stands. `pending` is what was typed and isn't yet the saved
 * value: while it is typed, while it saves, and (kept) when the save fails. The
 * saved value itself always comes from the data hook, so a change from the
 * partner shows up in a field nobody is editing.
 */
export interface FieldState<T> {
  status: FieldStatus;
  pending: { value: T; baseline?: T } | null;
  /** What the last save carried, kept for Try again. */
  attempt: { value: T } | null;
}

export type FieldAction<T> =
  | { type: "type"; value: T }
  | { type: "save"; value: T }
  /** `current` is the saved value as the data hook shows it when the write is confirmed. */
  | { type: "saved"; value: T; current: T }
  | { type: "failed" }
  /** Nothing to save: the value was cleared where that isn't allowed, or put back as it was. */
  | { type: "revert" };

export const initialField = <T,>(): FieldState<T> => ({ status: "idle", pending: null, attempt: null });

export function fieldReducer<T>(equals: (a: T, b: T) => boolean) {
  return (state: FieldState<T>, action: FieldAction<T>): FieldState<T> => {
    switch (action.type) {
      case "type":
        return { ...state, pending: { value: action.value } };
      case "save":
        return { status: "saving", pending: { value: action.value }, attempt: { value: action.value } };
      case "saved":
        // Typed on after Enter, while this save ran: that newer text stays, and
        // the field saves it when it's left or Enter is pressed again.
        if (state.pending && !equals(state.pending.value, action.value)) {
          return { status: "saved", pending: { value: state.pending.value }, attempt: null };
        }
        return {
          status: "saved",
          // Firestore usually shows its own write before confirming it. If the
          // value hasn't arrived yet, keep showing what was typed until it does.
          pending: equals(action.value, action.current) ? null : { value: action.value, baseline: action.current },
          attempt: null,
        };
      case "failed":
        return { ...state, status: "failed", pending: state.pending ?? state.attempt };
      case "revert":
        return initialField<T>();
    }
  };
}

/** What the input shows: what was typed, else the saved value. */
export function draftOf<T>(state: FieldState<T>, saved: T, equals: (a: T, b: T) => boolean): T {
  const { pending } = state;
  if (!pending) return saved;
  // A confirmed write whose value has since arrived (or been replaced) no longer counts.
  if ("baseline" in pending && pending.baseline !== undefined && !equals(saved, pending.baseline)) return saved;
  return pending.value;
}
