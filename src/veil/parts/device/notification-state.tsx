import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import styles from "./notification-state.module.css";

/**
 * What this device allows for reminders: the browser's permission, `install`
 * (an iPhone in the browser, which can only receive them from the home screen)
 * or `unsupported` (a browser with no notifications at all), N6.
 */
export type Permission = "granted" | "default" | "denied" | "install" | "unsupported";

export interface NotificationStateProps {
  /** `checking` (before the browser has been asked) shows nothing. */
  permission: Permission | "checking";
  /**
   * Settings has the test button and a button to allow. The event sheet's
   * "Remind us" has only a link to allow.
   */
  where?: "settings" | "sheet";
  /** Demonstration mode: the actions are inert. */
  disabled?: boolean;
  onAllow?: () => void;
  onTest?: () => void;
  /** The test is on its way. */
  testing?: boolean;
  /** The last test couldn't be sent (§9.1 G33). */
  testFailed?: boolean;
  /** Allowed, but this device couldn't be saved for reminders (§9.1 G33), with a way to try again. */
  setupFailed?: boolean;
  onRetrySetup?: () => void;
  /** Where Show me how goes: the install steps in settings. */
  installHref?: string;
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

const ELSEWHERE = "They still arrive on your other devices where they’re allowed.";

/**
 * Guide §4.30 and §6.12: how the device's permission is explained where the
 * reminders are set. Allowed says reminders arrive; not yet allowed offers a way
 * to allow; turned off says where to turn them on, in rose; an iPhone in the
 * browser says to add it to the home screen first; a browser that can't says
 * which can. Each says whether reminders still reach your other devices.
 */
export function NotificationState({
  permission,
  where = "settings",
  disabled = false,
  onAllow,
  onTest,
  testing = false,
  testFailed = false,
  setupFailed = false,
  onRetrySetup,
  installHref = "#install",
}: NotificationStateProps) {
  const inSettings = where === "settings";

  if (permission === "checking") return null;

  if (permission === "granted" && setupFailed) {
    return (
      <p className={`${styles.note} ${styles.off}`} role="alert">
        Allowed, but this <Device /> couldn’t be set up for reminders, so they won’t arrive here yet. {ELSEWHERE}{" "}
        <TextLink tone="rose" disabled={disabled} onClick={onRetrySetup}>
          Try again
        </TextLink>
      </p>
    );
  }

  if (permission === "granted") {
    return (
      <>
        <p className={styles.note}>
          Arrives on this <Device /> and your other devices, even when the planner is closed.
        </p>
        {inSettings ? (
          <div className={styles.action}>
            <Btn variant="quiet" small disabled={disabled} busy={testing} busyLabel="Sending" onClick={onTest}>
              Send a test reminder
            </Btn>
          </div>
        ) : null}
        {inSettings && testFailed ? (
          <p className={`${styles.note} ${styles.off}`} role="alert">
            Couldn’t send a test reminder. Try again.
          </p>
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

  if (permission === "install") {
    return (
      <>
        <p className={styles.note}>
          On an iPhone, reminders can only arrive once the planner is on your home screen. Add it there, open it from the
          home screen, then allow notifications.{inSettings ? null : " Until then, they arrive only on your other devices."}
        </p>
        <div className={styles.action}>
          {inSettings ? (
            <Btn variant="quiet" small href={installHref}>
              Show me how
            </Btn>
          ) : (
            <TextLink href={installHref}>Show me how</TextLink>
          )}
        </div>
      </>
    );
  }

  if (permission === "unsupported") {
    return (
      <p className={`${styles.note} ${styles.off}`}>
        This browser can’t show reminders from the planner, even with it installed, so they won’t arrive on this{" "}
        <Device />. {ELSEWHERE} To get them here, open the planner in a recent Safari, Chrome, Edge or Firefox.
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
