import type { ReactNode } from "react";
import { rp } from "@/lib/model/format";
import { TextLink } from "@/veil/parts/actions/text-link";
import { LinkedText } from "@/veil/parts/fields/notes";
import styles from "./menu-card-list.module.css";

export interface MenuOption {
  id: string;
  name: string;
  /** A price option has one; a category has none, so its card has no leader or price. */
  price?: number | null;
  /** What's included, under the name. */
  includes?: string | null;
  /** A second muted line: "120 reviews. Next: Send the quote". */
  meta?: string | null;
  /** Written notes in ink under it, their web addresses as links. */
  notes?: string | null;
  /** The option the couple lean towards. It says so instead of offering the action. */
  preferred?: boolean;
  /** Muted words at the end of the line, in the price's place: "Ours, 3 vendors". */
  note?: string;
  /** This option's own actions ("Rename", "Remove"), in place of the list-wide Lean, Edit and Remove. */
  actions?: ReactNode;
  /** Takes the card's whole place while it is open for a rename or a question. */
  replace?: ReactNode;
}

export interface MenuCardListProps {
  options: MenuOption[];
  /** Each action shows when its handler is passed, so a screen decides what can change. */
  onLean?: (option: MenuOption) => void;
  onEdit?: (option: MenuOption) => void;
  onRemove?: (option: MenuOption) => void;
}

/**
 * Price options, packages and categories as a printed menu (guide §4.8): the
 * name, a dotted leader and the price in serif, what's included under it, then
 * the actions. The preferred option reads "The one we’re leaning towards" in gold.
 */
export function MenuCardList({ options, onLean, onEdit, onRemove }: MenuCardListProps) {
  return (
    <ul className={styles.menuCard}>
      {options.map((option) => {
        if (option.replace) return <li key={option.id}>{option.replace}</li>;
        const hasActions = Boolean(option.actions || option.preferred || onLean || onEdit || onRemove);
        return (
          <li key={option.id}>
            <div className={styles.line}>
              <span className={styles.on} dir="auto">
                {option.name}
              </span>
              {typeof option.price === "number" ? (
                <>
                  <span className={styles.lead} aria-hidden="true" />
                  <span className={`${styles.op} num`}>{rp(option.price)}</span>
                </>
              ) : option.note ? (
                <>
                  <span className={styles.lead} aria-hidden="true" />
                  <span className={styles.note}>{option.note}</span>
                </>
              ) : null}
            </div>
            {option.includes ? (
              <p className={styles.inc} dir="auto">
                {option.includes}
              </p>
            ) : null}
            {option.meta ? <p className={styles.inc}>{option.meta}</p> : null}
            {option.notes ? (
              <p className={`${styles.inc} ${styles.written}`} dir="auto">
                <LinkedText text={option.notes} />
              </p>
            ) : null}
            {hasActions ? (
              <div className={styles.acts}>
                {option.actions ?? (
                  <>
                    {option.preferred ? (
                      <span className={styles.pref}>The one we’re leaning towards</span>
                    ) : onLean ? (
                      <TextLink onClick={() => onLean(option)}>Lean towards this one</TextLink>
                    ) : null}
                    {onEdit ? <TextLink onClick={() => onEdit(option)}>Edit</TextLink> : null}
                    {onRemove ? (
                      <TextLink tone="rose" onClick={() => onRemove(option)}>
                        Remove
                      </TextLink>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
