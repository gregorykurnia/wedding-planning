"use client";

import { useState, type InputHTMLAttributes } from "react";
import type { Read } from "@/lib/model/vendor-detail";
import { useFieldContext, type Bound } from "./fields";
import styles from "./fields.module.css";

type NumberInputProps<P extends string> = Omit<Bound<number | null>, "onChange"> &
  Pick<InputHTMLAttributes<HTMLInputElement>, "placeholder" | "inputMode"> & {
    id?: string;
    /** Spread from `field.bind`; the field has nothing to report until it is left. */
    onChange?: unknown;
    /** How the saved value reads in the box: `dec` for a rating, `n0` for a count. */
    show: (value: number) => string;
    /** What the typed text means: a value, no value, or why it can't be used. */
    read: (text: string) => Read<number, P>;
    /** What the row says when the old value comes back (N16's pattern). */
    say: (problem: P, typed: string, before: number | null) => string;
  };

/**
 * A number field that isn't money: a rating, a count of people. It follows
 * the money field's rules (guide §4.9, N16): what's typed is kept while you
 * type, leaving saves a usable value, and text that isn't one puts the old
 * value back with a line that quotes it. The line goes as soon as a usable
 * value is typed. A blank field is no value (null).
 */
export function NumberInput<P extends string>({
  value,
  onCommit,
  disabled,
  id,
  placeholder,
  inputMode = "decimal",
  show,
  read,
  say,
}: NumberInputProps<P>) {
  const field = useFieldContext();
  const [typing, setTyping] = useState<string | null>(null);
  const shown = typing ?? (value === null ? "" : show(value));

  const leave = (text: string) => {
    setTyping(null);
    const result = read(text);
    if (!result.ok) {
      field?.setProblem(say(result.problem, text, value));
      return;
    }
    field?.setProblem(null);
    onCommit?.(result.value);
  };

  return (
    <input
      inputMode={inputMode}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      placeholder={placeholder}
      id={id ?? field?.controlId}
      className={`${styles.input} num`}
      value={shown}
      disabled={disabled || field?.disabled}
      onFocus={() => setTyping(shown)}
      onChange={(event) => {
        setTyping(event.target.value);
        if (read(event.target.value).ok) field?.setProblem(null);
      }}
      onBlur={(event) => leave(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") leave(event.currentTarget.value);
      }}
    />
  );
}
