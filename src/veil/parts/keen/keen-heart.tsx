import { Heart } from "@/veil/icons/heart";
import { keenLabel } from "./keen-text";
import styles from "./keen.module.css";

export interface KeenHeartProps {
  /** The vendor's or venue's name, read as "Keen on …". */
  name: string;
  /** Pressed when the vendor is one we're keen on. */
  keen: boolean;
  /** Demonstration mode: the heart is inert. */
  disabled?: boolean;
  /** Called with the new value; the screen writes it and shows the toast. */
  onToggle?: (keen: boolean) => void;
}

/**
 * Guide §4.22: an 18px line heart, grey when off and filled rose when pressed,
 * the one rose element a vendor row allows. It's a toggle button, so the
 * pressed state is `aria-pressed`, and the label doesn't change.
 */
export function KeenHeart({ name, keen, disabled = false, onToggle }: KeenHeartProps) {
  return (
    <button
      type="button"
      className={styles.keen}
      aria-pressed={keen}
      aria-label={keenLabel(name)}
      disabled={disabled}
      onClick={() => onToggle?.(!keen)}
    >
      <Heart />
    </button>
  );
}
