import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import styles from "./text-link.module.css";

type TextLinkProps = {
  /** Rose for a destructive or failed action: "Remove this booking", "Try again". */
  tone?: "ink" | "rose";
  /** Renders a link to this path rather than a button that acts in place. */
  href?: string;
  /** A write is running: the label becomes `busyLabel` and presses do nothing, as Btn does. */
  busy?: boolean;
  busyLabel?: ReactNode;
  /** Focus starts here when it's rendered: a confirm's Keep it. */
  autoFocus?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  children: ReactNode;
};

const holdNavigation: MouseEventHandler<HTMLElement> = (event) => event.preventDefault();

/** Guide §4.11. Underlined text in ink, with a champagne underline. */
export function TextLink({
  tone = "ink",
  href,
  busy = false,
  busyLabel,
  autoFocus = false,
  disabled = false,
  onClick,
  children,
}: TextLinkProps) {
  const className = tone === "rose" ? `${styles.link} ${styles.rose}` : styles.link;
  const label = busy && busyLabel !== undefined ? busyLabel : children;
  // A busy link stays focusable (aria-disabled, not disabled), so focus doesn't drop.
  const busyAria = busy ? { "aria-busy": true, "aria-disabled": true } : {};
  if (href !== undefined) {
    return (
      <Link href={href} className={className} onClick={busy ? holdNavigation : onClick} {...busyAria}>
        {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      autoFocus={autoFocus}
      onClick={busy ? undefined : onClick}
      {...busyAria}
    >
      {label}
    </button>
  );
}
