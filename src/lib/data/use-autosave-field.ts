"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  draftOf,
  fieldReducer,
  initialField,
  saveLine,
  type FieldStatus,
  type SaveLine,
} from "@/lib/model/save-state";
import { toWriteError, type WriteError } from "./write-error";
import { useSession } from "./session";

/**
 * Save as you go (guide §4.9, §6.1). A screen (or a sheet that edits a record)
 * is one save scope: every field reports to it, and its save line says
 * "Every change saves as you go", "Saving", "Saved" or "1 change not saved".
 */
export interface SaveScope {
  /** Demonstration mode: fields are disabled and the line says nothing is saved. */
  demo: boolean;
  /** A sheet that edits a record: its line carries the failure and one Try again for every field. */
  sheet: boolean;
  line: SaveLine;
  /** Some change is on its way. A sheet scope holds its sheet meanwhile. */
  saving: boolean;
  report: (id: string, status: FieldStatus, retry?: () => void) => void;
  forget: (id: string) => void;
  /** Try again for every field whose change didn't save. */
  retryAll: () => void;
}

export const SaveScopeContext = createContext<SaveScope | null>(null);

/** The state behind a screen's save scope. `demo` overrides the session, for the gallery. */
export function useSaveScopeState(demo?: boolean, sheet = false): SaveScope {
  const { connection } = useSession();
  const inDemo = demo ?? connection === "demo";
  const [statuses, setStatuses] = useState<Record<string, FieldStatus>>({});
  const retries = useRef(new Map<string, () => void>());

  const report = useCallback((id: string, status: FieldStatus, retry?: () => void) => {
    if (status === "failed" && retry) retries.current.set(id, retry);
    else retries.current.delete(id);
    setStatuses((current) => (current[id] === status ? current : { ...current, [id]: status }));
  }, []);

  const forget = useCallback((id: string) => {
    retries.current.delete(id);
    setStatuses((current) => {
      if (!(id in current)) return current;
      const rest = { ...current };
      delete rest[id];
      return rest;
    });
  }, []);

  const retryAll = useCallback(() => {
    for (const retry of [...retries.current.values()]) retry();
  }, []);

  const line = useMemo(() => saveLine(Object.values(statuses), inDemo), [statuses, inDemo]);
  const saving = Object.values(statuses).includes("saving");

  return useMemo(
    () => ({ demo: inDemo, sheet, line, saving, report, forget, retryAll }),
    [inDemo, sheet, line, saving, report, forget, retryAll],
  );
}

export interface AutosaveOptions<T> {
  /** The saved value, from the data hook. */
  value: T;
  /** Writes the new value. A rejection means it didn't land; the typed value is kept. */
  save: (next: T) => Promise<unknown>;
  /** A blank value isn't allowed (a name): the old one comes back instead of saving it. */
  required?: boolean;
  /** Tidies a value before it's compared and saved, such as trimming text. */
  normalize?: (next: T) => T;
  equals?: (a: T, b: T) => boolean;
}

export interface AutosaveField<T> {
  /** What the input shows. */
  draft: T;
  status: FieldStatus;
  failed: boolean;
  /** Why the last save failed. */
  error: WriteError | null;
  /** Demonstration mode: nothing is saved, and the field can't be edited. */
  disabled: boolean;
  /** Typing: updates what the input shows, saves nothing. */
  change: (next: T) => void;
  /** Blur or a pick: saves `next` (or, given nothing, what was typed) when it differs from the saved value. */
  commit: (...next: [] | [T]) => void;
  /** Try again with the value that didn't save. */
  retry: () => void;
  /** What a control takes: `<FieldInput {...field.bind} />`. */
  bind: { value: T; onChange: (next: T) => void; onCommit: (next: T) => void; disabled: boolean };
}

const same = <T,>(a: T, b: T) => Object.is(a, b);

const isBlank = (value: unknown) => value === null || value === undefined || (typeof value === "string" && value.trim() === "");

/**
 * One field's save: on blur or change it saves, the screen's save line follows
 * Saving → Saved, and a failure keeps what was typed with a rose ring and a Try
 * again. A cleared name (`required`) goes back to the old one rather than
 * saving nothing. In demonstration mode the field is disabled.
 */
export function useAutosaveField<T>({
  value,
  save,
  required = false,
  normalize,
  equals = same,
}: AutosaveOptions<T>): AutosaveField<T> {
  const id = useId();
  const scope = useContext(SaveScopeContext);
  const { connection } = useSession();
  const disabled = scope ? scope.demo : connection === "demo";

  const reducer = useMemo(() => fieldReducer<T>(equals), [equals]);
  const [state, dispatch] = useReducer(reducer, undefined, initialField<T>);
  const [error, setError] = useState<WriteError | null>(null);

  // The latest of each, for handlers that run after a render has moved on.
  const latest = useRef({ value, save, state });
  useEffect(() => {
    latest.current = { value, save, state };
  });
  const token = useRef(0);
  const reportRef = useRef(scope);
  useEffect(() => {
    reportRef.current = scope;
  });

  // A field that goes away stops counting toward its screen's line, and a write
  // that finishes afterwards has nobody to tell.
  useEffect(() => {
    const requests = token;
    return () => {
      requests.current += 1;
      reportRef.current?.forget(id);
    };
  }, [id]);

  // The failure registers a Try again that calls `run` again, so it goes through a ref.
  const again = useRef<(next: T) => void>(() => {});
  const run = useCallback(
    (next: T) => {
      const mine = ++token.current;
      dispatch({ type: "save", value: next });
      setError(null);
      reportRef.current?.report(id, "saving");
      latest.current
        .save(next)
        .then(() => {
          if (mine !== token.current) return;
          dispatch({ type: "saved", value: next, current: latest.current.value });
          reportRef.current?.report(id, "saved");
        })
        .catch((err: unknown) => {
          if (mine !== token.current) return;
          setError(toWriteError(err));
          dispatch({ type: "failed" });
          reportRef.current?.report(id, "failed", () => again.current(next));
        });
    },
    [id],
  );

  useEffect(() => {
    again.current = run;
  }, [run]);

  const change = useCallback((next: T) => dispatch({ type: "type", value: next }), []);

  const commit = useCallback(
    (...typed: [] | [T]) => {
      if (disabled) return;
      const { state: current, value: saved } = latest.current;
      // `null` is a value too (a blank money field), so only no argument means "what was typed".
      const raw = typed.length ? typed[0] : draftOf(current, saved, equals);
      const next = normalize ? normalize(raw) : raw;
      // Leaving a field whose change didn't save keeps it as it is: Try again
      // is a press, and re-saving on blur would remove the button mid-click.
      if (current.status === "failed" && current.attempt && equals(next, current.attempt.value)) return;
      // Enter, then blur: the same value twice is one save.
      if (current.status === "saving" && current.attempt && equals(next, current.attempt.value)) return;
      if (required && isBlank(next)) {
        // Cleared a name: the old one comes back; a failed change is dropped with it.
        token.current += 1;
        dispatch({ type: "revert" });
        setError(null);
        reportRef.current?.report(id, "idle");
        return;
      }
      if (equals(next, saved) && current.status !== "saving") {
        // Put back as it was: nothing to save, and nothing left to fail.
        token.current += 1;
        dispatch({ type: "revert" });
        setError(null);
        reportRef.current?.report(id, "idle");
        return;
      }
      run(next);
    },
    [disabled, equals, id, normalize, required, run],
  );

  const retry = useCallback(() => {
    const attempt = latest.current.state.attempt;
    if (attempt) run(attempt.value);
  }, [run]);

  const draft = draftOf(state, value, equals);

  return {
    draft,
    status: state.status,
    failed: state.status === "failed",
    error,
    disabled,
    change,
    commit,
    retry,
    bind: { value: draft, onChange: change, onCommit: commit, disabled },
  };
}
