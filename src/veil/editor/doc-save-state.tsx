import { docSaveText, type DocSaveKind } from "@/lib/model/documents";
import { TextLink } from "@/veil/parts/actions/text-link";
import styles from "./toolbar.module.css";

/**
 * Where the document's saving stands, at the far end of the toolbar (guide
 * §4.24): a sage tick and "Saved 2 hours ago", a gold dot and "Not saved yet",
 * a spinner and "Saving", or a rose note with Try again. On a phone it floats
 * at the top, and a failure becomes a full-width note under the top bar.
 */
export function DocSaveState({
  kind,
  savedAgo,
  onRetry,
}: {
  kind: DocSaveKind;
  /** "just now", "2 hours ago", or null for a document that hasn't been saved. */
  savedAgo: string | null;
  onRetry: () => void;
}) {
  const failed = kind === "failed" || kind === "offline";
  return (
    <p className={styles.saveState} data-state={kind} role="status" aria-live="polite">
      {kind === "saved" && <span className={styles.tick} aria-hidden="true" />}
      {kind === "unsaved" && <span className={styles.dot} aria-hidden="true" />}
      {kind === "saving" && <span className={styles.spin} aria-hidden="true" />}
      <span>{docSaveText(kind, savedAgo)}</span>
      {failed && (
        <>
          {" "}
          <TextLink tone="rose" onClick={onRetry}>
            Try again
          </TextLink>
        </>
      )}
    </p>
  );
}
