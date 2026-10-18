"use client";

import Link from "next/link";
import {
  CARD_PACKAGES,
  finalistMeta,
  morePackages,
  noStep,
  stepText,
  type FinalistListItem,
} from "@/lib/model/shortlist";
import { PackageLines } from "@/veil/parts/menu-card/package-lines";
import { veilHref } from "@/veil/href";
import { useFlash } from "@/veil/shell/flash";
import styles from "./finalist-card.module.css";
import { BOOKED_FLAG } from "./shortlist-text";

/**
 * A finalist on the shortlist (guide §5.13): the name, "120 reviews, 12,3k
 * followers", up to four packages with the one we lean towards in gold italic,
 * and "Next: …" at the foot. A finalist that became a booking fades and carries
 * a gold flag. It flashes when the partner adds it.
 */
export function FinalistCard({ finalist }: { finalist: FinalistListItem }) {
  const flash = useFlash({ kind: "finalist", id: finalist.id });
  const step = stepText(finalist.step);
  const classes = [styles.card, finalist.booked && styles.booked, flash].filter(Boolean).join(" ");

  return (
    <li className={classes} data-finalist-id={finalist.id}>
      {finalist.booked ? <span className={styles.flag}>{BOOKED_FLAG}</span> : null}
      <Link className={styles.name} href={veilHref(`/vendors/shortlist/${finalist.id}`)} dir="auto">
        {finalist.name}
      </Link>
      <span className={styles.meta}>{finalistMeta(finalist)}</span>
      {finalist.packages.length > 0 ? (
        <PackageLines
          packages={finalist.packages.slice(0, CARD_PACKAGES)}
          more={morePackages(finalist.packages.length)}
        />
      ) : null}
      <p className={styles.step}>
        {step ? (
          <>
            <span>Next:</span> <span dir="auto">{step}</span>
          </>
        ) : (
          <span>{noStep}</span>
        )}
      </p>
    </li>
  );
}
