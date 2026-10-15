import Link from "next/link";
import { Back } from "@/veil/icons/back";
import { veilHref } from "../href";
import styles from "./back-link.module.css";

/**
 * A small muted link above the hero that names the parent screen, like
 * "‹ Budget" (guide §3). Lists reached from the menu have none.
 */
export function BackLink({ path, label }: { path: string; label: string }) {
  return (
    <Link href={veilHref(path)} className={styles.back}>
      <Back className={styles.icon} />
      {label}
    </Link>
  );
}
