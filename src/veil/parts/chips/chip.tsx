import { useRef, type KeyboardEvent, type MouseEventHandler, type ReactNode } from "react";
import styles from "./chip.module.css";

type ChipProps = {
  /** A toggle: `aria-pressed` says whether it's on. Leave it out for an action chip. */
  pressed?: boolean;
  /** Dashed, for a management action such as "Edit categories". */
  dashed?: boolean;
  /** A count after the name, already formatted: "Decoration 12". */
  count?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  children: ReactNode;
};

/** Guide §4.10. A pill: white with an edge, ink when pressed. */
export function Chip({ pressed, dashed = false, count, className, onClick, children }: ChipProps) {
  const classes = [styles.chip, dashed && styles.dashed, className].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} aria-pressed={pressed} onClick={onClick}>
      {children}
      {count !== undefined ? <small className={styles.count}>{count}</small> : null}
    </button>
  );
}

type ChipGroupProps<T extends string> = {
  /** What the choice is for, read out with the group. */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Demonstration mode: every chip is inert. */
  disabled?: boolean;
};

/**
 * Guide §4.10 and §8. A single choice: a radio group of chips. One tab stop,
 * on the chosen chip; the arrow keys, Home and End move and choose, as in any
 * radio group.
 */
export function ChipGroup<T extends string>({ label, options, value, onChange, disabled = false }: ChipGroupProps<T>) {
  const chips = useRef<(HTMLButtonElement | null)[]>([]);
  const checked = Math.max(0, options.findIndex((option) => option.value === value));

  function choose(index: number) {
    if (disabled) return;
    onChange(options[index].value);
    chips.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = chips.current.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    const last = options.length - 1;
    let next: number | undefined;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = index === last ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = index === 0 ? last : index - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
    }
    if (next === undefined) return;
    event.preventDefault();
    choose(next);
  }

  return (
    <div role="radiogroup" aria-label={label} className={styles.chips} onKeyDown={onKeyDown}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(element) => {
            chips.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={index === checked ? 0 : -1}
          className={styles.chip}
          disabled={disabled}
          onClick={() => choose(index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
