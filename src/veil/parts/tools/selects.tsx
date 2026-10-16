import { useId, type ReactNode } from "react";
import { flip, startDirection, type Direction, type OrderChoice } from "@/lib/model/order";
import { Chevron } from "@/veil/icons/chevron";
import { DirectionWord } from "@/veil/parts/actions/direction-word";
import styles from "./tools.module.css";

/** The order on screen: which choice, and which way. */
export type OrderState<K extends string = string> = { key: K; direction: Direction };

type FilterSelectProps = {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  /** Anything after the select on the same line, such as the direction word. */
  children?: ReactNode;
};

/** Guide §4.12. A small underlined select with its label in front; the chevron is drawn beside it. */
export function FilterSelect({ label, value, options, onChange, children }: FilterSelectProps) {
  const id = useId();
  return (
    <span className={styles.order}>
      <label htmlFor={id}>{label}</label>
      <span className={styles.select}>
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Chevron className={styles.chevron} />
      </span>
      {children}
    </span>
  );
}

type OrderByProps<K extends string> = {
  /** The screen's choices from the model (`VENDOR_ORDERS`, `ITEM_ORDERS` …), each with the direction it starts in. */
  choices: readonly OrderChoice<K>[];
  order: OrderState<K>;
  onChange: (order: OrderState<K>) => void;
  /** Our own order has no direction, so items show none for it (guide §6.8). */
  directional?: boolean;
};

/**
 * Guide §4.12 and §6.8. "Order by", a select and Ascending or Descending. A new
 * choice starts in the direction the model gives it (numbers descending, text
 * ascending); the direction word flips the current one.
 */
export function OrderBy<K extends string>({ choices, order, onChange, directional = true }: OrderByProps<K>) {
  return (
    <FilterSelect
      label="Order by"
      value={order.key}
      options={choices.map((choice) => ({ value: choice.key, label: choice.label }))}
      onChange={(key) => {
        const next = key as K;
        onChange({ key: next, direction: startDirection(choices, next) });
      }}
    >
      {directional ? (
        <DirectionWord
          ascending={order.direction === "asc"}
          onToggle={() => onChange({ key: order.key, direction: flip(order.direction) })}
        />
      ) : null}
    </FilterSelect>
  );
}
