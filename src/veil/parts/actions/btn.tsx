import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { GoogleMark } from "@/veil/icons/google-mark";
import styles from "./btn.module.css";

/** Primary is the ink pill, quiet is outlined, danger is the rose confirm, google is the sign-in button. */
export type BtnVariant = "primary" | "quiet" | "danger" | "google";

type BtnProps = {
  variant?: BtnVariant;
  /** Tighter padding and 13.5px text, for rows and cards. */
  small?: boolean;
  /** The floating add button's shadow (`.add-fab`, guide §3). Its position is the caller's. */
  floating?: boolean;
  /** The spinner shows and `busyLabel` (the gerund) replaces the label. Presses do nothing until it's off. */
  busy?: boolean;
  busyLabel?: ReactNode;
  /** Renders a link to this path rather than a button. */
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  children: ReactNode;
};

const holdNavigation: MouseEventHandler<HTMLElement> = (event) => event.preventDefault();

/**
 * The shared button (guide §4.11), ported from the prototype's .btn and its
 * variants. Every ink, quiet, danger and Google button in the new UI is this.
 */
export function Btn({
  variant = "primary",
  small = false,
  floating = false,
  busy = false,
  busyLabel,
  href,
  type = "button",
  disabled = false,
  autoFocus = false,
  className,
  onClick,
  children,
}: BtnProps) {
  const classes = [
    styles.btn,
    variant !== "primary" && styles[variant],
    small && styles.small,
    floating && styles.floating,
    busy && styles.busy,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const label = busy && busyLabel !== undefined ? busyLabel : children;
  const content = (
    <>
      {variant === "google" ? <GoogleMark className={styles.mark} /> : null}
      {label}
    </>
  );
  // A busy button stays focusable (aria-disabled, not disabled), so focus doesn't drop.
  const busyAria = busy ? { "aria-busy": true, "aria-disabled": true } : {};

  if (href !== undefined) {
    return (
      <Link href={href} className={classes} onClick={busy ? holdNavigation : onClick} {...busyAria}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled}
      autoFocus={autoFocus}
      // preventDefault too, so a busy submit button can't send its form a second time.
      onClick={busy ? holdNavigation : onClick}
      {...busyAria}
    >
      {content}
    </button>
  );
}
