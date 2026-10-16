import { Chip } from "./chip";
import styles from "./focus-chips.module.css";

export type FocusChip = {
  id: string;
  label: string;
  /** Already formatted, shown after the name. */
  count?: string;
};

type FocusChipsProps = {
  /** The row's name for screen readers, such as "Focus on a category". */
  label: string;
  chips: readonly FocusChip[];
  /** The id of the pressed chip. */
  value: string;
  /** The caller resets its paging here. */
  onChoose: (id: string) => void;
  /** Shows the dashed "Edit categories" chip at the end when given. */
  onEdit?: () => void;
};

/**
 * Guide §4.13. A row of focus chips under a title: one pressed at a time, a
 * phone scrolls the row sideways, and a long name is cut with an ellipsis.
 */
export function FocusChips({ label, chips, value, onChoose, onEdit }: FocusChipsProps) {
  return (
    <div role="group" aria-label={label} className={styles.focus}>
      {chips.map((chip) => (
        <Chip
          key={chip.id}
          className={styles.chip}
          pressed={chip.id === value}
          count={chip.count}
          onClick={() => onChoose(chip.id)}
        >
          {chip.label}
        </Chip>
      ))}
      {onEdit !== undefined ? (
        <Chip dashed className={styles.chip} onClick={onEdit}>
          Edit categories
        </Chip>
      ) : null}
    </div>
  );
}
