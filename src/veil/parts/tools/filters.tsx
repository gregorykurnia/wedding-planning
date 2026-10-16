import { useState } from "react";
import { TextLink } from "@/veil/parts/actions/text-link";
import styles from "./tools.module.css";

type RangeFieldProps = {
  /** The words before the box: "Costs at most", "Holds at least". */
  label: string;
  /** The words after the box, if any: "guests". */
  unit?: string;
  /** null is "Any": nothing is limited. */
  value: number | null;
  /** The model's reader: `readAmount` gives null for blank and undefined for text that isn't an amount. */
  read: (text: string) => number | null | undefined;
  /** The model's way of writing the number back: `rp` for money, `n0` for a count. */
  show: (n: number) => string;
  onChange: (value: number | null) => void;
};

/**
 * Guide §4.12. A small underlined box with words either side. What's typed is
 * kept until the box is left or Enter is pressed; then it is read and written
 * back in the model's form ("Rp 45.000.000"). Text that isn't a number puts the
 * old value back without a message (G16/N16).
 */
export function RangeField({ label, unit, value, read, show, onChange }: RangeFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (value === null ? "" : show(value));

  function commit() {
    if (draft === null) return;
    setDraft(null);
    const next = read(draft);
    if (next !== undefined && next !== value) onChange(next);
  }

  return (
    <label className={styles.range}>
      {label}
      <input
        className={`num ${styles.input}`}
        inputMode="numeric"
        placeholder="Any"
        value={text}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
      {unit}
    </label>
  );
}

type FilterCheckProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** Guide §4.12. A check with its words after it: "Hide ruled out", "Work on next only". */
export function FilterCheck({ label, checked, onChange }: FilterCheckProps) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

type ShowEverythingProps = {
  /** Whether any filter is on. The screen works it out with the model's `isFiltering…` function. */
  filtering: boolean;
  /** "Show everyone" for the people filter. */
  label?: string;
  onClear: () => void;
};

/** Guide §4.12 and §6.8. A way back to everything, shown only while a filter is on. */
export function ShowEverything({ filtering, label = "Show everything", onClear }: ShowEverythingProps) {
  if (!filtering) return null;
  return <TextLink onClick={onClear}>{label}</TextLink>;
}
