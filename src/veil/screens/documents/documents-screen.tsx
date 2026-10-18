"use client";

import { useEffect, useState } from "react";
import { useDocuments } from "@/lib/data/documents";
import {
  CLEAR_SEARCH,
  DOCS_PAGE,
  EARLIER,
  NOTHING_WRITTEN,
  NO_RESULTS_BODY,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  START_BLANK,
  START_MEETING,
  documentView,
  documentsSub,
  earlierCount,
  matchCount,
  noResultsTitle,
  type DocumentListItem,
} from "@/lib/model/document-list";
import { Btn } from "@/veil/parts/actions/btn";
import { Hero } from "@/veil/parts/hero/hero";
import { Message } from "@/veil/parts/message/message";
import { DocumentCard } from "@/veil/parts/rows/document-card";
import { DocumentRow } from "@/veil/parts/rows/document-row";
import { Ledger } from "@/veil/parts/rows/ledger";
import { CountLine, ShowMore } from "@/veil/parts/tools/results";
import { SearchField } from "@/veil/parts/tools/search-field";
import { veilHref } from "@/veil/href";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { SubNav } from "@/veil/shell/sub-nav";
import styles from "./documents-screen.module.css";

/** How often "Edited 12 min ago" is worked out again. */
const TICK_MS = 30_000;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const documentHref = (id: string) => veilHref(`/documents/${id}`);

/**
 * Documents (guide §5.16, R6): the two ways to start one, a search through titles
 * and everything written inside (tables too), the three newest as cards and the
 * rest as rows, 60 at a time. Loading, failed, offline and demonstration mode come
 * from the shared screen state; a document the partner starts arrives as the
 * shell's partner toast, and its card or row flashes.
 */
export function DocumentsScreen() {
  const read = useDocuments();
  return (
    <PageColumn width="wide">
      <ScreenState read={read} what="your documents" onRetry={() => window.location.reload()}>
        {(data) => <DocumentsList docs={data ?? []} />}
      </ScreenState>
    </PageColumn>
  );
}

function DocumentsList({ docs }: { docs: DocumentListItem[] }) {
  const now = useNow();
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(DOCS_PAGE);

  const searching = query.trim() !== "";
  const view = documentView(docs, query, shown, DOCS_PAGE);
  const rows = view.rest.slice(0, view.shown);

  const search = (next: string) => {
    setQuery(next);
    setShown(DOCS_PAGE);
  };

  const hero = (
    <Hero
      title="Documents"
      sub={documentsSub(docs.length)}
      nav={
        <>
          <SubNav set="records" current="/documents" />
          <div className={styles.starts}>
            <Btn href={veilHref("/documents/new?start=meeting")}>{START_MEETING}</Btn>
            <Btn variant="quiet" href={veilHref("/documents/new?start=blank")}>
              {START_BLANK}
            </Btn>
          </div>
        </>
      }
    />
  );

  if (docs.length === 0) {
    return (
      <>
        {hero}
        <Message kind="nothing-yet" inline title={NOTHING_WRITTEN.title}>
          {NOTHING_WRITTEN.body}
        </Message>
      </>
    );
  }

  return (
    <>
      {hero}
      <div className={styles.tools}>
        <SearchField label={SEARCH_LABEL} placeholder={SEARCH_PLACEHOLDER} value={query} onChange={search} />
      </div>

      {view.matched === 0 ? (
        <Message
          kind="no-results"
          inline
          title={noResultsTitle(query)}
          actions={
            <Btn variant="quiet" onClick={() => search("")}>
              {CLEAR_SEARCH}
            </Btn>
          }
        >
          {NO_RESULTS_BODY}
        </Message>
      ) : (
        <>
          {view.recent.length > 0 && (
            <ul className={styles.recent}>
              {view.recent.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} href={documentHref(doc.id)} now={now} />
              ))}
            </ul>
          )}
          {searching ? (
            <CountLine>{matchCount(view.matched)}</CountLine>
          ) : (
            view.rest.length > 0 && (
              <h2 className={styles.section}>
                {EARLIER} <small>{earlierCount(view.rest.length)}</small>
              </h2>
            )
          )}
          {rows.length > 0 && (
            <Ledger label="Documents">
              {rows.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} href={documentHref(doc.id)} now={now} query={query} />
              ))}
            </Ledger>
          )}
          <ShowMore more={view.more} onMore={() => setShown((count) => count + DOCS_PAGE)} />
        </>
      )}
    </>
  );
}
