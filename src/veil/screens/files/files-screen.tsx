"use client";

import { useSearchParams } from "next/navigation";
import { replaceAddress } from "@/veil/href";
import { useEffect, useMemo, useRef, useState } from "react";
import { deleteFolder, useFiles, type FilesData } from "@/lib/data/files";
import { useToday } from "@/lib/data/use-today";
import type { IsoDate } from "@/lib/model/bookings";
import { useUploadQueue } from "@/lib/data/uploads";
import {
  CLEAR_SEARCH,
  DELETE_FOLDER,
  EMPTY_FOLDER,
  FILES_HEADING,
  FILES_PAGE,
  FOLDERS_HEADING,
  HITS_PAGE,
  MOVE,
  NEWEST_FIRST,
  NEW_FOLDER,
  NO_FILES,
  NO_RESULTS_BODY,
  RENAME,
  SEARCH_LABEL,
  SEARCH_PLACEHOLDER,
  UPLOAD_FILES,
  addedOn,
  crumbs,
  deleteFolderConfirm,
  deletedFolderToast,
  emptyFirst,
  folderSub,
  folderTree,
  folderView,
  hitsCount,
  holdings,
  noResultsTitle,
  paging,
  searchFiles,
  thumbOf,
  topSub,
  type FileItem,
  type FolderTree,
} from "@/lib/model/files";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { FileDetailsSheet } from "@/veil/parts/files/file-details-sheet";
import { MoveSheet } from "@/veil/parts/files/move-sheet";
import { FILES_PATH, PathTrail, folderHref } from "@/veil/parts/files/path-trail";
import { useUploadSheet } from "@/veil/parts/files/upload-sheet";
import { Hero } from "@/veil/parts/hero/hero";
import { Message } from "@/veil/parts/message/message";
import { FileRow, FolderRow, type FileRowData } from "@/veil/parts/rows/file-row";
import { Ledger } from "@/veil/parts/rows/ledger";
import { CountLine, ShowMore } from "@/veil/parts/tools/results";
import { SearchField } from "@/veil/parts/tools/search-field";
import { useBlocked, useConfirm } from "@/veil/shell/confirm";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { SubNav } from "@/veil/shell/sub-nav";
import { useToast } from "@/veil/shell/toasts";
import { FolderSheet } from "./folder-sheet";
import styles from "./files-screen.module.css";

const EMPTY: FilesData = { folders: [], files: [] };

/**
 * Files (guide §5.18; R8–R14): the top level or a folder (`?folder=<id>`), its
 * folders and then its files, newest first, 100 at a time, and a search across
 * every folder by name and description, 200 at a time. Folders are made, renamed,
 * moved and deleted here; a file opens in its sheet (`?file=<id>` opens it on
 * arrival). Loading, failed, offline and demonstration mode come from the shared
 * screen state; a file the partner uploads arrives as the shell's partner toast
 * and its row flashes.
 */
export function FilesScreen() {
  const read = useFiles();
  return (
    <PageColumn width="wide">
      <ScreenState read={read} what="your files" onRetry={() => window.location.reload()}>
        {(data) => <Files data={data ?? EMPTY} />}
      </ScreenState>
    </PageColumn>
  );
}

function rowOf(file: FileItem, tree: FolderTree, today: IsoDate): FileRowData {
  return {
    id: file.id,
    name: file.name,
    size: file.size,
    date: addedOn(file, today),
    category: file.category,
    description: file.description,
    path: tree.path(file.folderId).map((f) => f.name),
    thumb: thumbOf(file),
  };
}

function Files({ data }: { data: FilesData }) {
  const params = useSearchParams();
  const sheets = useSheets();
  const toast = useToast();
  const confirm = useConfirm();
  const blocked = useBlocked();
  const today = useToday();

  const tree = useMemo(() => folderTree(data.folders), [data.folders]);
  const folderParam = params.get("folder");
  const here = folderParam && tree.byId.has(folderParam) ? folderParam : null;
  const current = here ? tree.byId.get(here)! : null;

  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(FILES_PAGE);
  const [hitsShown, setHitsShown] = useState(HITS_PAGE);
  const [unfolded, setUnfolded] = useState(false);

  // A file's own link (`?file=`) opens its sheet once, when the screen arrives or the link changes.
  const fileParam = params.get("file");
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (fileParam && opened.current !== fileParam && data.files.some((f) => f.id === fileParam)) {
      opened.current = fileParam;
      sheets.open(<FileDetailsSheet fileId={fileParam} />);
    }
  }, [fileParam, data.files, sheets]);

  // Each folder starts with its first page, and the full path folds again.
  const [seen, setSeen] = useState(here);
  if (seen !== here) {
    setSeen(here);
    setShown(FILES_PAGE);
    setUnfolded(false);
  }

  const queue = useUploadQueue({ kind: "folder", folderId: here, path: tree.path(here).map((f) => f.name) });
  const openUpload = useUploadSheet(queue);

  const searching = query.trim() !== "";
  const view = folderView(tree, data.files, here);
  const found = searchFiles(data.files, query, hitsShown);
  const page = paging(view.files.length, shown, FILES_PAGE);
  const bytes = data.files.reduce((sum, f) => sum + f.size, 0);

  const search = (next: string) => {
    setQuery(next);
    setHitsShown(HITS_PAGE);
  };
  const openFile = (row: FileRowData) => sheets.open(<FileDetailsSheet fileId={row.id} />);

  async function removeFolder() {
    if (!current) return;
    const held = holdings(tree, data.files, current.id);
    if (held.files || held.folders) {
      await blocked(emptyFirst(current.name, held));
      return;
    }
    const undone: { undo?: () => Promise<void> } = {};
    const gone = await confirm({
      ...deleteFolderConfirm(current.name),
      danger: true,
      run: async () => {
        undone.undo = (await deleteFolder(current.id)).undo;
      },
    });
    if (!gone || !undone.undo) return;
    const { undo } = undone;
    const { id, parentId } = current;
    replaceAddress(folderHref(parentId));
    toast.undoable(deletedFolderToast(current.name), async () => {
      await undo();
      replaceAddress(folderHref(id));
    });
  }

  const hero = (
    <Hero
      title={current ? current.name : "Files"}
      sub={
        current
          ? folderSub(view.folders.length, view.files.length)
          : topSub(data.files.length, bytes)
      }
      nav={
        <>
          {current ? (
            <div className={styles.folderActs}>
              <TextLink onClick={() => sheets.open(<FolderSheet parentId={current.parentId} folder={current} />)}>
                {RENAME}
              </TextLink>
              <TextLink onClick={() => sheets.open(<MoveSheet target={{ kind: "folder", id: current.id }} />)}>
                {MOVE}
              </TextLink>
              <TextLink tone="rose" onClick={() => void removeFolder()}>
                {DELETE_FOLDER}
              </TextLink>
            </div>
          ) : (
            <SubNav set="records" current={FILES_PATH} />
          )}
          <div className={styles.starts}>
            <Btn onClick={openUpload}>{UPLOAD_FILES}</Btn>
            <Btn variant="quiet" onClick={() => sheets.open(<FolderSheet parentId={here} />)}>
              {NEW_FOLDER}
            </Btn>
          </div>
        </>
      }
    />
  );

  const trail = <PathTrail crumbs={crumbs(tree, here, unfolded)} onUnfold={() => setUnfolded(true)} />;

  if (data.files.length === 0 && data.folders.length === 0) {
    return (
      <>
        {hero}
        <Message kind="nothing-yet" inline title={NO_FILES.title}>
          {NO_FILES.body}
        </Message>
      </>
    );
  }

  const folderRows = view.folders;
  const nothingHere = folderRows.length === 0 && view.files.length === 0;

  return (
    <>
      {trail}
      {hero}
      <div className={styles.tools}>
        <SearchField label={SEARCH_LABEL} placeholder={SEARCH_PLACEHOLDER} value={query} onChange={search} />
      </div>

      {searching ? (
        found.hits.length === 0 ? (
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
            <CountLine>{hitsCount(found.hits.length, found.shown)}</CountLine>
            <div className={styles.results}>
              <Ledger label="Files found">
                {found.hits.slice(0, found.shown).map((file) => (
                  <FileRow key={file.id} file={rowOf(file, tree, today)} today={today} withPath onOpen={openFile} />
                ))}
              </Ledger>
            </div>
            <ShowMore more={found.more} onMore={() => setHitsShown((count) => count + HITS_PAGE)} />
          </>
        )
      ) : nothingHere ? (
        <Message kind="nothing-yet" inline title={EMPTY_FOLDER.title}>
          {EMPTY_FOLDER.body}
        </Message>
      ) : (
        <>
          {folderRows.length > 0 && (
            <>
              <h2 className={styles.section}>{FOLDERS_HEADING}</h2>
              <Ledger label="Folders">
                {folderRows.map((folder) => (
                  <FolderRow key={folder.id} folder={folder} href={folderHref(folder.id)} />
                ))}
              </Ledger>
            </>
          )}
          {view.files.length > 0 && (
            <>
              <h2 className={styles.section}>
                {FILES_HEADING} <small>{NEWEST_FIRST}</small>
              </h2>
              <Ledger label="Files">
                {view.files.slice(0, page.shown).map((file) => (
                  <FileRow key={file.id} file={rowOf(file, tree, today)} today={today} onOpen={openFile} />
                ))}
              </Ledger>
              <ShowMore more={page.more} onMore={() => setShown((count) => count + FILES_PAGE)} />
            </>
          )}
        </>
      )}
    </>
  );
}
