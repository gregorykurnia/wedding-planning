import { waHref } from "@/lib/model/whatsapp";
import { WhatsApp } from "@/veil/icons/whatsapp";
import styles from "./whatsapp-link.module.css";

export interface WhatsAppLinkProps {
  /** The number as it was typed. With no usable number there is no link at all. */
  phone: string | null | undefined;
  /** "row" reads WhatsApp; "detail" reads Message on WhatsApp, on a detail screen. */
  variant?: "row" | "detail";
}

/**
 * Guide §4.23: a sage chat icon and the words, opening the number on wa.me in
 * a new tab. The number rules (a leading 0 becomes 62, no link without a
 * number) are in the model's `waHref`.
 */
export function WhatsAppLink({ phone, variant = "row" }: WhatsAppLinkProps) {
  const href = waHref(phone);
  if (href === null) return null;
  return (
    <a className={styles.wa} href={href} target="_blank" rel="noopener">
      <WhatsApp />
      {variant === "detail" ? "Message on WhatsApp" : "WhatsApp"}
    </a>
  );
}
