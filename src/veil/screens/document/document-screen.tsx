"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteDocumentForGood,
  saveDocument,
  useDocument,
  type DocumentDraft,
  type DocumentRead,
} from "@/lib/data/documents";
import { usePartnerName } from "@/lib/data/partner";
import { useDocumentPresence } from "@/lib/data/presence";
import { useSession } from "@/lib/data/session";
import { useToday } from "@/lib/data/use-today";
import { newId } from "@/lib/data/write";
import { dateLong, editedText } from "@/lib/model/dates";
import { EMPTY_DOC, MEETING_TITLE, deleteQuestion, meetingNotesDoc, titleOrUntitled } from "@/lib/model/documents";
import { DocEditor } from "@/veil/editor/doc-editor";
import { DocSaveState } from "@/veil/editor/doc-save-state";
import { useDocAutosave } from "@/veil/editor/use-doc-autosave";
import { useKeyboardDock } from "@/veil/editor/use-keyboard-dock";
import { veilHref } from "@/veil/href";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { Message } from "@/veil/parts/message/message";
import { BackLink } from "@/veil/shell/back-link";
import { Banner } from "@/veil/shell/banner";
import { useConfirm } from "@/veil/shell/confirm";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { useEditorToasts, useToast } from "@/veil/shell/toasts";
import { DELETED_HERE, DEMO_NONE, NOT_HERE, UNREADABLE, deletedElsewhere, lostOnLeave, partnerHere } from "./document-text";
import { LeaveSheet } from "./leave-sheet";
import styles from "./document-screen.module.css";

/** How often "Saved 12 min ago" and "Edited … ago" are worked out again. */
const TICK_MS = 30_000;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const toList = () => (
  <Btn href={veilHref("/documents")}>See all documents</Btn>
);

/**
 * A document (guide §5.17, R1, R5, R7). `id` "new" starts one from `start`;
 * it's made on its first save, and from then on the address is its own.
 */
export function DocumentScreen({ id, start }: { id: string; start: "meeting" | "blank" }) {
  const isNew = id === "new";
  const today = useToday();
  const [docId] = useState(() => {
    if (!isNew) return id;
    try {
      return newId("notes");
    } catch {
      return "demo"; // Demonstration mode: there is no database to make an id in.
    }
  });
  const [created, setCreated] = useState(!isNew);
  const read = useDocument(created ? docId : null);

  const [initial, setInitial] = useState<DocumentDraft | null>(() =>
    isNew
      ? start === "meeting"
        ? { title: MEETING_TITLE, content: meetingNotesDoc(dateLong(today, today)) }
        : { title: "", content: EMPTY_DOC }
      : null,
  );
  // The first time the document arrives, it is what the editor opens with.
  if (!initial && read.data) setInitial({ title: read.data.title, content: read.data.content });

  const onCreated = useCallback(() => {
    setCreated(true);
    // The page stays as it is; only the address changes to the document's own.
    window.history.replaceState(null, "", veilHref(`/documents/${docId}`));
  }, [docId]);

  return (
    <PageColumn width="doc">
      <BackLink path="/documents" label="Documents" />
      {initial ? (
        <OpenDocument
          docId={docId}
          fresh={isNew}
          created={created}
          onCreated={onCreated}
          initial={initial}
          read={read}
        />
      ) : (
        <BeforeOpen read={read} />
      )}
    </PageColumn>
  );
}

/** What shows until the document has arrived: loading, a failure, offline, an old link, demonstration mode. */
function BeforeOpen({ read }: { read: DocumentRead }) {
  if (read.status === "missing") {
    return (
      <Message kind="gone" title={NOT_HERE.title} actions={toList()}>
        {NOT_HERE.body}
      </Message>
    );
  }
  if (read.status === "gone") {
    const words = deletedElsewhere(read.by);
    return (
      <Message kind="gone" title={words.title} actions={toList()}>
        {words.body}
      </Message>
    );
  }
  if (read.status === "demo") {
    return (
      <Message kind="nothing-yet" title={DEMO_NONE.title} actions={toList()}>
        {DEMO_NONE.body}
      </Message>
    );
  }
  return (
    <ScreenState read={{ status: read.status, data: null }} what="this document" onRetry={() => window.location.reload()}>
      {() => null}
    </ScreenState>
  );
}

type OpenDocumentProps = {
  docId: string;
  /** Started on this visit ("New document"): no Delete until it exists. */
  fresh: boolean;
  created: boolean;
  onCreated: () => void;
  initial: DocumentDraft;
  read: DocumentRead;
};

function OpenDocument({ docId, fresh, created, onCreated, initial, read }: OpenDocumentProps) {
  const router = useRouter();
  const sheets = useSheets();
  const toast = useToast();
  const confirm = useConfirm();
  const { connection, user } = useSession();
  const { name: partner } = usePartnerName();
  const presence = useDocumentPresence(created ? docId : null);
  const now = useNow();
  useEditorToasts();
  useKeyboardDock();

  const demo = connection === "demo";
  const [deleted, setDeleted] = useState<"no" | "deleting" | "yes">("no");
  const [unreadable, setUnreadable] = useState(false);
  const onUnreadable = useCallback(() => setUnreadable(true), []);
  const createdRef = useRef(created);
  const titleRef = useRef(initial.title);

  const autosave = useDocAutosave<DocumentDraft>({
    demo,
    offline: connection === "offline",
    savedAt: fresh ? null : (read.data?.updatedAt ?? null),
    save: async (draft) => {
      await saveDocument(docId, draft, { created: createdRef.current });
      if (!createdRef.current) {
        createdRef.current = true;
        onCreated();
      }
    },
    onLostOnLeave: (retry) => {
      const offer = () =>
        toast.next(lostOnLeave(titleRef.current), "Try again", () => {
          void retry().then((ok) => (ok ? toast.confirmation("Saved") : offer()));
        });
      offer();
    },
  });

  const change = autosave.change;
  const onChange = useCallback(
    (draft: DocumentDraft) => {
      titleRef.current = draft.title;
      change(draft);
    },
    [change],
  );

  // The tab names the document.
  const title = read.data?.title ?? initial.title;
  useEffect(() => {
    document.title = `${titleOrUntitled(titleRef.current || title)} · Our wedding planner`;
  }, [title]);

  // N18: Back, the menu and the names wait for the save; if it can't save, they ask first.
  const { abandon, retry, flush, hasUnsaved } = autosave;
  const kindRef = useRef(autosave.kind);
  useEffect(() => {
    kindRef.current = autosave.kind;
  });
  useEffect(() => {
    const ask = (go: () => void) =>
      sheets.open(
        <LeaveSheet
          offline={kindRef.current === "offline"}
          onLeave={() => {
            abandon();
            go();
          }}
          onStay={retry}
        />,
      );
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      // Links inside the document open their bubble instead (doc-editor.tsx).
      if (link.closest("[data-doc-paper]")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (!hasUnsaved()) return;
      e.preventDefault();
      const go = () => router.push(`${url.pathname}${url.search}${url.hash}`);
      if (kindRef.current === "failed" || kindRef.current === "offline") {
        ask(go);
        return;
      }
      void flush().then((ok) => (ok ? go() : ask(go)));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [abandon, retry, flush, hasUnsaved, router, sheets]);

  // Deleted while open: nothing more is saved into it.
  const gone = read.status === "gone";
  useEffect(() => {
    if (gone) abandon();
  }, [gone, abandon]);

  const incoming = useMemo<DocumentDraft | null>(
    () => (read.data && !read.pending ? { title: read.data.title, content: read.data.content } : null),
    [read.data, read.pending],
  );

  if (deleted === "yes" || (gone && deleted === "deleting")) {
    return (
      <Message kind="gone" title={DELETED_HERE.title} actions={toList()}>
        {DELETED_HERE.body}
      </Message>
    );
  }
  if (gone) {
    const words = deletedElsewhere(read.by);
    return (
      <Message kind="gone" title={words.title} actions={toList()}>
        {words.body}
      </Message>
    );
  }

  const editedBy = read.data?.updatedBy && read.data.updatedBy !== user?.uid ? partner : null;
  const meta = fresh || !read.data ? "New document" : `Edited ${editedText(read.data.updatedAt, now, editedBy)}`;
  const savedAgo = autosave.savedAt === null ? null : editedText(autosave.savedAt, now);

  async function remove() {
    const words = deleteQuestion(titleRef.current, partner);
    await confirm({
      title: words.title,
      body: words.body,
      action: words.action,
      run: async () => {
        setDeleted("deleting");
        try {
          await deleteDocumentForGood(docId, titleRef.current);
        } catch (err) {
          setDeleted("no");
          throw err;
        }
        autosave.abandon();
        setDeleted("yes");
      },
    });
  }

  return (
    <>
      <DocEditor
        initial={initial}
        incoming={incoming}
        hasUnsaved={autosave.hasUnsaved}
        editable={!demo}
        focusTitle={fresh}
        meta={meta}
        onChange={onChange}
        onUnreadable={onUnreadable}
        saveState={<DocSaveState kind={autosave.kind} savedAgo={savedAgo} onRetry={autosave.retry} />}
        banner={
          unreadable ? (
            <div className={styles.banner}>
              <Banner role="status">{UNREADABLE}</Banner>
            </div>
          ) : presence.partnerHere ? (
            <div className={styles.banner}>
              <Banner>
                <span className={styles.syncDot} aria-hidden="true" />
                {partnerHere(presence.partner)}
              </Banner>
            </div>
          ) : null
        }
      />
      {/* Not on a document started on this visit (guide §5.17). */}
      {!fresh && !demo && (
        <div className={styles.dangerZone}>
          <TextLink tone="rose" onClick={() => void remove()}>
            Delete this document
          </TextLink>
        </div>
      )}
    </>
  );
}
