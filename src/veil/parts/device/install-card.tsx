import { Btn } from "@/veil/parts/actions/btn";
import styles from "./install-card.module.css";

export interface InstallCardProps {
  /** Where "Show me how" goes: the install steps on the settings page. */
  howHref: string;
  /** "Not now" hides the card. The screen remembers it for this device (Task 6.4). */
  onNotNow?: () => void;
}

/**
 * Guide §4.30: the install suggestion on the overview, for a phone, once. The
 * screen decides when to show it; this part only draws it.
 */
export function InstallCard({ howHref, onNotNow }: InstallCardProps) {
  return (
    <section className={styles.install}>
      <p>Add the planner to your home screen to open it like an app.</p>
      <div className={styles.actions}>
        <Btn small href={howHref}>
          Show me how
        </Btn>
        <Btn small variant="quiet" onClick={onNotNow}>
          Not now
        </Btn>
      </div>
    </section>
  );
}
