import type { ReactNode } from "react";
import { RibbonKnot } from "@/veil/icons/ribbon-knot";
import { StruckCloud } from "@/veil/icons/struck-cloud";
import styles from "./message.module.css";

/** Which mark a message gets (guide §4.18). A record that's gone gets the knot. */
export type MessageKind = "nothing-yet" | "no-results" | "failure" | "offline" | "gone";

type MessageProps = {
  kind: MessageKind;
  /** The serif title. */
  title: ReactNode;
  /** Under a hero, keeping the screen's title and sub-navigation: 28px and a level-two heading. */
  inline?: boolean;
  /** One or two sentences. */
  children?: ReactNode;
  /** Centred buttons, such as Try again or Show everything. */
  actions?: ReactNode;
};

/**
 * A centred message for a screen with nothing to show (guide §4.18). A full
 * screen message has a level-one title; an inline one sits under a hero, so
 * its title is level two.
 */
export function Message({ kind, title, inline = false, children, actions }: MessageProps) {
  const Heading = inline ? "h2" : "h1";
  return (
    <div className={inline ? `${styles.message} ${styles.inline}` : styles.message}>
      <Mark kind={kind} />
      <Heading className={styles.title}>{title}</Heading>
      {children ? <p className={styles.body}>{children}</p> : null}
      {actions ? <div className={styles.acts}>{actions}</div> : null}
    </div>
  );
}

function Mark({ kind }: { kind: MessageKind }) {
  if (kind === "no-results") return null;
  if (kind === "offline") return <StruckCloud className={styles.mark} />;
  return <RibbonKnot className={styles.mark} />;
}
