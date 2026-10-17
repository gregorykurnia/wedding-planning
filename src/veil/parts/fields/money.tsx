"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { readAmount } from "@/lib/model/amount";
import { rp } from "@/lib/model/format";
import { useFieldContext, type Bound } from "./fields";
import styles from "./fields.module.css";

type MoneyInputProps = Omit<Bound<number | null>, "onChange"> &
  Pick<InputHTMLAttributes<HTMLInputElement>, "placeholder" | "aria-label" | "autoFocus"> & {
    id?: string;
    /** Spread from `field.bind`; a money field has nothing to report until it is left. */
    onChange?: unknown;
  };

/**
 * A money field (guide §4.9): a numeric keyboard, "Rp 12.500.000" once you
 * leave it, and "Rp 0" as the placeholder. It saves on blur and Enter. Text
 * that isn't an amount (words, a minus) puts the old amount back instead of
 * saving; a blank field is no amount (null).
 */
export function MoneyInput({ value, onCommit, disabled, id, placeholder = "Rp 0", ...rest }: MoneyInputProps) {
  const field = useFieldContext();
  const [typing, setTyping] = useState<string | null>(null);
  const shown = typing ?? (value === null ? "" : rp(value));

  const leave = (text: string) => {
    setTyping(null);
    const amount = readAmount(text);
    if (amount !== undefined) onCommit?.(amount);
  };

  return (
    <input
      inputMode="numeric"
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      placeholder={placeholder}
      aria-label={rest["aria-label"]}
      autoFocus={rest.autoFocus}
      id={id ?? field?.controlId}
      className={`${styles.input} num`}
      value={shown}
      disabled={disabled || field?.disabled}
      onFocus={() => setTyping(shown)}
      onChange={(event) => setTyping(event.target.value)}
      onBlur={(event) => leave(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") leave(event.currentTarget.value);
      }}
    />
  );
}

type BigInputProps = {
  /** What is typed, exactly. The form owns it, so it can put an amount back when one is refused. */
  text: string;
  onText: (text: string) => void;
  /** Leaving the field: the form tidies it to "Rp 12.500.000", or refuses it. */
  onLeave?: (text: string) => void;
  onEnter?: () => void;
  onFocus?: () => void;
  /** Read by screen readers; the amount has no visible label. */
  label: string;
  id?: string;
  autoFocus?: boolean;
  /** Rose underline: the text isn't an amount. */
  invalid?: boolean;
  "aria-describedby"?: string;
};

/**
 * The amount in Record a payment (guide §4.9): serif 40px, centred, with an
 * underline that turns rose on focus. It belongs to a form that saves on a
 * button, so it only reports what is typed: the form reads it, tidies it to
 * "Rp 12.500.000" on blur and puts the old amount back when it isn't one.
 */
export const BigInput = forwardRef<HTMLInputElement, BigInputProps>(function BigInput(
  { text, onText, onLeave, onEnter, onFocus, label, id, autoFocus, invalid, ...rest },
  ref,
) {
  return (
    <>
      <label className="sr" htmlFor={id}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        inputMode="numeric"
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        aria-describedby={rest["aria-describedby"]}
        className={`${styles.big} ${invalid ? styles.bigBad : ""} num`}
        placeholder="Rp 0"
        value={text}
        onFocus={onFocus}
        onChange={(event) => onText(event.target.value)}
        onBlur={(event) => onLeave?.(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEnter?.();
        }}
      />
    </>
  );
});
