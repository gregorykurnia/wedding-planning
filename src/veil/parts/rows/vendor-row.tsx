"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { plural, rp } from "@/lib/model/format";
import { TextLink } from "@/veil/parts/actions/text-link";
import { useFlash } from "@/veil/shell/flash";
import { ratingParts, vendorMeta } from "./ledger-text";
import styles from "./rows.module.css";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export interface VendorRowData {
  id: string;
  name: string;
  category?: string | null;
  contact?: string | null;
  /** The preferred price option, or the first one when none is preferred; `null` with no options. */
  price: number | null;
  /** How many price options there are; the count shows past one. */
  optionCount: number;
  /** Out of five, or `null` before any review. */
  rating: number | null;
  reviewers: number;
  /** Ruled out: the name greyed and struck through. */
  ruledOut?: boolean;
}

export interface VendorRowProps {
  vendor: VendorRowData;
  /** The vendor's or venue's own page. */
  href: string;
  /** A venue flashes under its own kind, a vendor under its own. */
  kind?: "vendor" | "venue";
  /** The category goes in the meta line only when the list isn't already grouped by it. */
  showCategory?: boolean;
  /** "On the shortlist" links to the finalist when the vendor is one. */
  shortlistHref?: string | null;
  /**
   * The keen heart at the start of the name, the stage thread and the WhatsApp
   * link. They are Task 3.9's: until then the screen leaves them out.
   */
  keen?: ReactNode;
  stage?: ReactNode;
  whatsApp?: ReactNode;
}

/**
 * A vendor or venue in its list (guide §4.7): the name with its keen heart, the
 * preferred price or "No price yet", the category and contact, the rating, and a
 * foot with the stage, WhatsApp, the shortlist link and the price options.
 */
export function VendorRow({
  vendor,
  href,
  kind = "vendor",
  showCategory = false,
  shortlistHref,
  keen,
  stage,
  whatsApp,
}: VendorRowProps) {
  const flash = useFlash({ kind, id: vendor.id });
  const rating = ratingParts(vendor.rating, vendor.reviewers);

  return (
    <li className={join(vendor.ruledOut && styles.ruled, flash)} data-vendor-id={vendor.id}>
      <div className={styles.vrow}>
        <span className={styles.first}>
          {keen}
          <Link className={styles.vname} href={href} dir="auto">
            {vendor.name}
          </Link>
        </span>
        {vendor.price !== null ? (
          <span className={join(styles.vprice, "num")}>{rp(vendor.price)}</span>
        ) : (
          <span className={styles.none}>No price yet</span>
        )}
        <span className={styles.meta} dir="auto">
          {vendorMeta(vendor.category, vendor.contact, showCategory)}
        </span>
        <span className={styles.right}>
          {rating ? (
            <>
              <b className={styles.score}>{rating.score}</b> {rating.rest}
            </>
          ) : (
            "No rating yet"
          )}
        </span>
        <div className={styles.foot}>
          {stage}
          {whatsApp}
          {shortlistHref ? <TextLink href={shortlistHref}>On the shortlist</TextLink> : null}
          {vendor.price !== null && vendor.optionCount > 1 ? (
            <span className={styles.meta}>{plural(vendor.optionCount, "price option")}</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}
