"use client";

import Link from "next/link";
import { editedText } from "@/lib/model/dates";
import { useFlash } from "@/veil/shell/flash";
import { extractText } from "./ledger-text";
import type { DocumentRowData } from "./document-row";
import styles from "./rows.module.css";

/**
 * One of the three newest documents (guide §5.16): its title, a four-line
 * extract, and "Edited 2 hours ago by Bella" at the foot. The whole card is a
 * link. Cards only show when nobody is searching, so they never mark matches.
 */
export function DocumentCard({ doc, href, now }: { doc: DocumentRowData; href: string; now: number }) {
  const flash = useFlash({ kind: "document", id: doc.id });

  return (
    <li className={flash}>
      <Link className={styles.dcard} href={href} data-doc-id={doc.id}>
        <h2 className={styles.dcardTitle} dir="auto">
          {doc.title || <span className={styles.untitled}>Untitled</span>}
        </h2>
        <p className={styles.dcardExtract} dir="auto">
          {extractText(doc.text, "")}
        </p>
        <span className={styles.dcardWhen}>Edited {editedText(doc.editedAt, now, doc.editedBy)}</span>
      </Link>
    </li>
  );
}
