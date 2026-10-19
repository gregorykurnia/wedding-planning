"use client";

import type { ItemRecord } from "@/lib/model/items";
import { useFlasher, type FlashTarget } from "@/veil/shell/flash";
import styles from "./items.module.css";

export interface WorkOnNextCardProps {
  /** The marked items, up to 12, and how many more there are (the model's `workOnNext`). */
  shown: readonly ItemRecord[];
  more: number;
  /**
   * A marked item whose row isn't on the page yet (a long list shows 150 at a
   * time). The screen shows enough rows to include it and then calls `jumpToItem`.
   */
  onMissing?: (item: ItemRecord) => void;
}

/** Scrolls to an item's row, flashes it and puts the cursor in its name. False when the row isn't on the page. */
export function jumpToItem(id: string, flash: (target: FlashTarget) => void): boolean {
  const row = document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`);
  if (!row) return false;
  row.scrollIntoView({ block: "center", behavior: "smooth" });
  flash({ kind: "item", id });
  row.querySelector<HTMLElement>("[data-item-name]")?.focus({ preventScroll: true });
  return true;
}

/**
 * The "To work on next" card (guide §4.28): a champagne pill for each marked
 * item. Pressing one scrolls to its row, flashes it and puts the cursor in its
 * name. Draws nothing when nothing is marked.
 */
export function WorkOnNextCard({ shown, more, onMissing }: WorkOnNextCardProps) {
  const flash = useFlasher();
  if (shown.length === 0) return null;

  const jump = (item: ItemRecord) => {
    if (!jumpToItem(item.id, flash)) onMissing?.(item);
  };

  return (
    <section className={styles.nextcard} aria-labelledby="work-on-next">
      <h2 id="work-on-next">To work on next</h2>
      <ul>
        {shown.map((item) => (
          <li key={item.id}>
            <button type="button" dir="auto" onClick={() => jump(item)}>
              {item.item}
            </button>
          </li>
        ))}
        {more > 0 ? <li className={styles.nextMore}>and {more} more</li> : null}
      </ul>
    </section>
  );
}
