import styles from "./direction-word.module.css";

type DirectionWordProps = {
  ascending: boolean;
  onToggle: () => void;
};

/** Guide §4.11 and §4.12. The direction of an "Order by": a plain word that flips the order. */
export function DirectionWord({ ascending, onToggle }: DirectionWordProps) {
  return (
    <button type="button" className={styles.dir} onClick={onToggle}>
      {ascending ? "Ascending" : "Descending"}
    </button>
  );
}
