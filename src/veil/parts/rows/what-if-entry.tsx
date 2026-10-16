"use client";

import { rp } from "@/lib/model/format";
import { whatIfTotal, type Funder, type WhatIfRecord } from "@/lib/model/money";
import { TextLink } from "@/veil/parts/actions/text-link";
import { PartLines } from "@/veil/parts/menu-card/part-lines";
import { useFlash } from "@/veil/shell/flash";
import { whatIfMeta, whatIfPartLines } from "./ledger-text";
import styles from "./rows.module.css";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/** A what-if item, with the category it's filed under (the model's record has none). */
export type WhatIfItem = WhatIfRecord & { category?: string | null };

export interface WhatIfEntryProps {
  item: WhatIfItem;
  funders: Funder[];
  /** Edit and Remove each show only when their handler is passed. */
  onEdit?: (item: WhatIfItem) => void;
  onRemove?: (item: WhatIfItem) => void;
}

/**
 * A what-if item (guide §4.7): its name and projected price in italic, who would
 * pay it, its parts with dashed leaders, and Edit and Remove. None of it is real
 * money yet.
 */
export function WhatIfEntry({ item, funders, onEdit, onRemove }: WhatIfEntryProps) {
  const flash = useFlash({ kind: "whatif", id: item.id });
  const hasParts = (item.subEntries?.length ?? 0) > 0;

  return (
    <li className={join(styles.whatIf, flash)}>
      <div className={styles.entry} data-whatif-id={item.id}>
        <span className={styles.entryName} dir="auto">
          {item.name}
        </span>
        <span className={join(styles.entryPrice, "num")}>{rp(whatIfTotal(item))}</span>
        <span className={styles.meta} dir="auto">
          {whatIfMeta(item, funders)}
        </span>
        {hasParts ? (
          <div className={styles.partsSlot}>
            <PartLines {...whatIfPartLines(item, funders)} hypothetical />
          </div>
        ) : null}
        {onEdit || onRemove ? (
          <div className={styles.acts}>
            {onEdit ? <TextLink onClick={() => onEdit(item)}>Edit</TextLink> : null}
            {onRemove ? (
              <TextLink tone="rose" onClick={() => onRemove(item)}>
                Remove
              </TextLink>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
