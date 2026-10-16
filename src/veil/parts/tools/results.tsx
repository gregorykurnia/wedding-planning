import type { ReactNode } from "react";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { moreText, sortedNoteText } from "./tools-text";
import styles from "./tools.module.css";

/**
 * Guide §4.12. The count above the results, from the words in `tools-text.ts`.
 * It is polite-live, so a screen reader hears the count change as results do.
 */
export function CountLine({ children }: { children: ReactNode }) {
  return (
    <p className={styles.count} aria-live="polite">
      {children}
    </p>
  );
}

type SortedNoteProps = {
  /** The order's label from the model, "Vendor": the note lower-cases it. */
  label: string;
  onBack: () => void;
};

/** Guide §6.8. The gold pill over a list sorted for now; "Back to our order" puts the list back. */
export function SortedNote({ label, onBack }: SortedNoteProps) {
  return (
    <p className={styles.sorted}>
      {sortedNoteText(label)} <TextLink onClick={onBack}>Back to our order</TextLink>
    </p>
  );
}

/**
 * Guide §6.8. The button under a long list. It always says how many more it
 * shows, and nothing is shown when there are none. The screen's `onMore` adds
 * the next page to what is shown.
 */
export function ShowMore({ more, onMore }: { more: number; onMore: () => void }) {
  if (more <= 0) return null;
  return (
    <p className={styles.more}>
      <Btn variant="quiet" onClick={onMore}>
        {moreText(more)}
      </Btn>
    </p>
  );
}
