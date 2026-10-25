import styles from "./items.module.css";

/** The column heads over the item rows (guide §4.28). Under 860px the rows stack and there are none. */
export function ItemHeads() {
  return (
    <div className={styles.ihead} aria-hidden="true">
      <span />
      <span>Item</span>
      <span>Category</span>
      <span>Vendor</span>
      <span>Events</span>
      <span>Who it’s for</span>
      <span className={styles.center}>Next</span>
      <span className={styles.center}>Confirmed</span>
      <span />
    </div>
  );
}
