"use client";

import { useState, type InputHTMLAttributes } from "react";
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
  /** The amount; null while the field is blank. */
  value: number | null;
  /** Every keystroke that reads as an amount, so a preview line can follow it. */
  onChange: (next: number | null) => void;
  /** Read by screen readers; the amount has no visible label. */
  label: string;
  id?: string;
  autoFocus?: boolean;
  "aria-describedby"?: string;
};

/**
 * The amount in Record a payment (guide §4.9): serif 40px, centred, with an
 * underline that turns rose on focus. It belongs to a form that saves on a
 * button, so it reports as you type and tidies to "Rp 12.500.000" on blur.
 */
export function BigInput({ value, onChange, label, id, autoFocus, ...rest }: BigInputProps) {
  const [typing, setTyping] = useState<string | null>(null);
  const shown = typing ?? (value === null ? "" : rp(value));
  return (
    <>
      <label className="sr" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoFocus={autoFocus}
        aria-describedby={rest["aria-describedby"]}
        className={`${styles.big} num`}
        placeholder="Rp 0"
        value={shown}
        onChange={(event) => {
          setTyping(event.target.value);
          const amount = readAmount(event.target.value);
          if (amount !== undefined) onChange(amount);
        }}
        onBlur={() => setTyping(null)}
      />
    </>
  );
}
