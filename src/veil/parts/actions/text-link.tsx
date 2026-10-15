import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import styles from "./text-link.module.css";

type TextLinkProps = {
  /** Rose for a destructive or failed action: "Remove this booking", "Try again". */
  tone?: "ink" | "rose";
  /** Renders a link to this path rather than a button that acts in place. */
  href?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  children: ReactNode;
};

/** Guide §4.11. Underlined text in ink, with a champagne underline. */
export function TextLink({ tone = "ink", href, onClick, children }: TextLinkProps) {
  const className = tone === "rose" ? `${styles.link} ${styles.rose}` : styles.link;
  if (href !== undefined) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}
