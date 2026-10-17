"use client";

import {
  createContext,
  useContext,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { SaveScopeContext } from "@/lib/data/use-autosave-field";
import { FIELD_FAILED } from "@/lib/model/save-state";
import styles from "./fields.module.css";

/** What a control takes from `useAutosaveField`: spread `field.bind` onto it. */
export type Bound<T> = {
  value: T;
  /** Typing: the screen keeps what is shown. Nothing is saved. */
  onChange?: (next: T) => void;
  /** Blur or a pick: save this value. */
  onCommit?: (next: T) => void;
  disabled?: boolean;
};

type FieldContextValue = {
  controlId: string;
  labelId: string;
  describedBy: string | undefined;
  /** A change that didn't save, or a value that can't be saved. */
  invalid: boolean;
  disabled: boolean;
  /**
   * A control that refuses what was typed says why here (a money field, N16):
   * the row rings rose and shows the line, until the control clears it.
   */
  setProblem: (line: string | null) => void;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext() {
  return useContext(FieldContext);
}

/** The list of rows on a detail screen, or in a sheet (guide §4.9). */
export function Fields({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `${styles.fields} ${className}` : styles.fields}>{children}</div>;
}

type FieldRowProps = {
  label: ReactNode;
  /** The label is for screen readers only and the value takes the whole row (the notes editor). */
  hideLabel?: boolean;
  /** The control isn't one input (chips, a stepper, a static value), so the label names the group. */
  group?: boolean;
  /** Muted text under the value. Hidden while there is a failure or a problem to say. */
  hint?: ReactNode;
  /**
   * The autosave field behind the control. A change that didn't save gets the
   * rose ring and "Couldn't save this change. What you typed is kept. Try
   * again"; demonstration mode disables the row.
   */
  field?: { failed: boolean; retry: () => void; disabled: boolean };
  /** A value that can't be saved ("Give the booking a name…"): the same look as a failure. */
  problem?: ReactNode;
  /** The rose ring and `aria-invalid` with no line of its own, when a box elsewhere says what's wrong (sign-in). */
  invalid?: boolean;
  /** The label above the value at every width, as on a phone: the sign-in form. */
  stacked?: boolean;
  children: ReactNode;
};

/**
 * One row: a muted label column and the value, a hairline below and 56px at
 * least; the label sits above the value on a phone (guide §4.9).
 */
export function FieldRow({
  label,
  hideLabel = false,
  group = false,
  hint,
  field,
  problem: problemProp,
  invalid = false,
  stacked = false,
  children,
}: FieldRowProps) {
  const id = useId();
  const [refusal, setRefusal] = useState<string | null>(null);
  const problem = problemProp ?? refusal;
  const controlId = `${id}-control`;
  const labelId = `${id}-label`;
  const noteId = `${id}-note`;
  // A sheet says what failed once, in its save line; its fields keep only the ring.
  const inSheet = Boolean(useContext(SaveScopeContext)?.sheet);
  const failed = Boolean(field?.failed);
  const failure = failed && !inSheet;
  const disabled = Boolean(field?.disabled);
  const note = failure || problem ? "err" : hint ? "hint" : null;

  const classes = [
    styles.field,
    hideLabel ? styles.single : "",
    stacked ? styles.stacked : "",
    failed ? styles.failed : "",
    problem || invalid ? styles.problem : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} aria-disabled={disabled || undefined}>
      {group ? (
        <span className={hideLabel ? "sr" : styles.label} id={labelId}>
          {label}
        </span>
      ) : (
        <label className={hideLabel ? "sr" : styles.label} id={labelId} htmlFor={controlId}>
          {label}
        </label>
      )}
      <FieldContext.Provider
        value={{
          controlId,
          labelId,
          describedBy: note ? noteId : undefined,
          invalid: failed || invalid || Boolean(problem),
          disabled,
          setProblem: setRefusal,
        }}
      >
        {children}
      </FieldContext.Provider>
      {failure && field ? (
        <p className={styles.err} id={noteId}>
          <span>{FIELD_FAILED}</span>
          <button type="button" className={`${styles.link} ${styles.rose}`} onClick={field.retry}>
            Try again
          </button>
        </p>
      ) : problem ? (
        <p className={styles.err} id={noteId} role="alert">
          {problem}
        </p>
      ) : hint ? (
        <p className={styles.hint} id={noteId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Muted text under a value, when it is used outside a `FieldRow`. */
export function Hint({ children }: { children: ReactNode }) {
  return <p className={styles.hint}>{children}</p>;
}

/** A value that can't be edited here: "Rp 150.000.000 from 3 parts". */
export function StaticValue({ children }: { children: ReactNode }) {
  return <span className={`${styles.static} num`}>{children}</span>;
}

type InputAttributes = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur" | "disabled" | "type" | "id"
>;

type FieldInputProps = Bound<string> &
  InputAttributes & {
    id?: string;
    type?: "text" | "email" | "tel" | "url" | "password";
    /** For a screen that moves focus into the field (React 19 passes it down as a prop). */
    ref?: Ref<HTMLInputElement>;
  };

/** A text field. Saves on blur and on Enter. */
export function FieldInput({ value, onChange, onCommit, disabled, id, type = "text", ...rest }: FieldInputProps) {
  const field = useFieldContext();
  return (
    <input
      dir="auto"
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      {...rest}
      id={id ?? field?.controlId}
      type={type}
      className={styles.input}
      value={value}
      disabled={disabled || field?.disabled}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={(event) => onCommit?.(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onCommit?.(event.currentTarget.value);
      }}
    />
  );
}

type FieldTextProps = Bound<string> &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "onBlur" | "disabled" | "id"> & {
    id?: string;
  };

/** A textarea. Enter makes a new line; it saves on blur. */
export function FieldText({ value, onChange, onCommit, disabled, id, ...rest }: FieldTextProps) {
  const field = useFieldContext();
  return (
    <textarea
      dir="auto"
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      {...rest}
      id={id ?? field?.controlId}
      className={`${styles.input} ${styles.textarea}`}
      value={value}
      disabled={disabled || field?.disabled}
      onChange={(event) => onChange?.(event.target.value)}
      onBlur={(event) => onCommit?.(event.currentTarget.value)}
    />
  );
}

type DateInputProps = Bound<string> &
  Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur" | "disabled" | "type" | "id"> & {
    id?: string;
  };

/**
 * A native date field; the value is "YYYY-MM-DD" or "". A date typed one digit
 * at a time passes through years like 0002 and 0020, so a change saves once the
 * year has four digits, and a blur saves whatever is left.
 */
export function DateInput({ value, onChange, onCommit, disabled, id, ...rest }: DateInputProps) {
  const field = useFieldContext();
  return (
    <input
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      {...rest}
      id={id ?? field?.controlId}
      type="date"
      className={styles.input}
      value={value}
      disabled={disabled || field?.disabled}
      onChange={(event) => {
        const next = event.target.value;
        onChange?.(next);
        if (/^\d{4}-/.test(next) && Number(next.slice(0, 4)) >= 1000) onCommit?.(next);
      }}
      onBlur={(event) => onCommit?.(event.currentTarget.value)}
    />
  );
}

type FieldSelectProps = Bound<string> &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "onBlur" | "disabled" | "id" | "children"> & {
    id?: string;
    options: readonly { value: string; label: string }[];
  };

/** A select with no arrow: it reads as text, and a pick saves at once. */
export function FieldSelect({ value, onChange, onCommit, disabled, id, options, ...rest }: FieldSelectProps) {
  const field = useFieldContext();
  return (
    <select
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      {...rest}
      id={id ?? field?.controlId}
      className={`${styles.input} ${styles.select}`}
      value={value}
      disabled={disabled || field?.disabled}
      onChange={(event) => {
        onChange?.(event.target.value);
        onCommit?.(event.target.value);
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

type CheckProps = Bound<boolean> & { children: ReactNode };

/** A check with a rose accent; a tick saves at once. */
export function Check({ value, onChange, onCommit, disabled, children }: CheckProps) {
  const field = useFieldContext();
  return (
    <label className={styles.check}>
      <input
        type="checkbox"
        aria-describedby={field?.describedBy}
        checked={value}
        disabled={disabled || field?.disabled}
        onChange={(event) => {
          onChange?.(event.target.checked);
          onCommit?.(event.target.checked);
        }}
      />
      {children}
    </label>
  );
}

type StepperProps = Bound<number> & {
  min?: number;
  max?: number;
  /** Names the group when the stepper isn't inside a `FieldRow`. */
  label?: string;
};

/** A stepper for plus-ones: − 2 +. Every press saves. */
export function Stepper({ value, onChange, onCommit, disabled, min = 0, max = 20, label }: StepperProps) {
  const field = useFieldContext();
  const off = disabled || field?.disabled;
  const step = (by: number) => {
    const next = Math.max(min, Math.min(max, value + by));
    if (next === value) return;
    onChange?.(next);
    onCommit?.(next);
  };
  return (
    <span
      className={styles.stepper}
      role="group"
      aria-label={label}
      aria-labelledby={label ? undefined : field?.labelId}
    >
      <button type="button" aria-label="One fewer" disabled={off || value <= min} onClick={() => step(-1)}>
        −
      </button>
      <b aria-live="polite">{value}</b>
      <button type="button" aria-label="One more" disabled={off || value >= max} onClick={() => step(1)}>
        +
      </button>
    </span>
  );
}
