"use client";

import Link from "next/link";
import { Fragment } from "react";
import { editedText } from "@/lib/model/dates";
import { highlight } from "@/lib/model/search";
import { useFlash } from "@/veil/shell/flash";
import { extractText } from "./ledger-text";
import styles from "./rows.module.css";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export interface DocumentRowData {
  id: string;
  /** Empty for an untitled document, which reads "Untitled" in italic. */
  title: string;
  /** The document's words with its markup taken out, tables included. */
  text: string;
  /** When it was last edited, in ms since the epoch; `null` when not known. */
  editedAt: number | null;
  /** Who edited it, or `null` when it was the reader, who isn't named. */
  editedBy: string | null;
}

export interface DocumentRowProps {
  doc: DocumentRowData;
  /** The document's own page. */
  href: string;
  /** Now, in ms, for "12 min ago by Bella". */
  now: number;
  /** The search, when one is on: its matches are marked in the title and the extract. */
  query?: string;
}

/** The pieces of a text with the search matches marked. */
function Marked({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((piece, index) =>
        piece.match ? (
          <mark key={index} className={styles.mark}>
            {piece.text}
          </mark>
        ) : (
          <Fragment key={index}>{piece.text}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * A document in the Documents list (guide §4.7): its title, when and by whom it
 * was last edited on the right, and a line of its words under the title. A search
 * marks its matches. The whole row is a link.
 */
export function DocumentRow({ doc, href, now, query = "" }: DocumentRowProps) {
  const flash = useFlash({ kind: "document", id: doc.id });

  return (
    <li className={flash}>
      <Link className={join(styles.drow, styles.linkRow)} href={href} data-doc-id={doc.id}>
        <span className={styles.docName} dir="auto">
          {doc.title ? <Marked text={doc.title} query={query} /> : <span className={styles.untitled}>Untitled</span>}
        </span>
        <span className={styles.docWhen}>{editedText(doc.editedAt, now, doc.editedBy)}</span>
        <span className={styles.docExtract} dir="auto">
          <Marked text={extractText(doc.text, query)} query={query} />
        </span>
      </Link>
    </li>
  );
}
