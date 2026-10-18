import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import styles from "./notification-state.module.css";

/** The browser's notification permission on this device. "Unsupported" waits for need N6. */
export type Permission = "granted" | "default" | "denied";

export interface NotificationStateProps {
  permission: Permission;
  /**
   * Settings has the test button and a button to allow. The event sheet's
   * "Remind us" has only a link to allow.
   */
  where?: "settings" | "sheet";
  /** Demonstration mode: the actions are inert. */
  disabled?: boolean;
  onAllow?: () => void;
  onTest?: () => void;
}

/** "phone" under 760px and "computer" above, as the prototype and the offline copy do. The hidden word isn't read out. */
export function Device() {
  return (
    <>
      <span className={styles.phone}>phone</span>
      <span className={styles.computer}>computer</span>
    </>
  );
}

/**
 * Guide §4.30 and §6.12: how the device's permission is explained where the
 * reminders are set. Allowed says reminders arrive; not yet allowed offers a way
 * to allow; turned off says where to turn them on, in rose.
 */
export function NotificationState({ permission, where = "settings", disabled = false, onAllow, onTest }: NotificationStateProps) {
  const inSettings = where === "settings";

  if (permission === "granted") {
    return (
      <>
        <p className={styles.note}>
          Arrives on this <Device /> and your other devices, even when the planner is closed.
        </p>
        {inSettings ? (
          <div className={styles.action}>
            <Btn variant="quiet" small disabled={disabled} onClick={onTest}>
              Send a test reminder
            </Btn>
          </div>
        ) : null}
      </>
    );
  }

  if (permission === "denied") {
    return (
      <p className={`${styles.note} ${styles.off}`}>
        Turned off for the planner on this <Device />. Reminders can’t arrive here until you turn them on in{" "}
        <span className={styles.phone}>your phone’s Settings, under Notifications</span>
        <span className={styles.computer}>the browser’s site settings for the planner</span>.
      </p>
    );
  }

  return (
    <>
      <p className={styles.note}>
        Not allowed yet on this <Device />. Allow them to get reminders when the planner is closed.
      </p>
      <div className={styles.action}>
        {inSettings ? (
          <Btn small disabled={disabled} onClick={onAllow}>
            Allow notifications
          </Btn>
        ) : (
          <TextLink disabled={disabled} onClick={onAllow}>
            Allow notifications
          </TextLink>
        )}
      </div>
    </>
  );
}
