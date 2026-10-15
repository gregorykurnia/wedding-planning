import { rp } from "@/lib/model/format";
import { TextLink } from "@/veil/parts/actions/text-link";
import styles from "./menu-card-list.module.css";

export interface MenuOption {
  id: string;
  name: string;
  /** A price option has one; a category has none, so its card has no leader or price. */
  price?: number | null;
  /** What's included, under the name. */
  includes?: string | null;
  /** The option the couple lean towards. It says so instead of offering the action. */
  preferred?: boolean;
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
        const hasActions = Boolean(option.preferred || onLean || onEdit || onRemove);
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
              ) : null}
            </div>
            {option.includes ? (
              <p className={styles.inc} dir="auto">
                {option.includes}
              </p>
            ) : null}
            {hasActions ? (
              <div className={styles.acts}>
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
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
