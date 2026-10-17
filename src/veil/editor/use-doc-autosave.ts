"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { WriteError } from "@/lib/data/write-error";
import type { DocSaveKind } from "@/lib/model/documents";
import { DocSaver } from "./doc-saver";

export interface DocAutosave<D> {
  kind: DocSaveKind;
  savedAt: number | null;
  /** The editor or the title changed. */
  change: (draft: D) => void;
  /** Saves now; true once everything has landed. */
  flush: () => Promise<boolean>;
  retry: () => void;
  /** Leave without the unsaved changes (N18), or after deleting: nothing more is saved. */
  abandon: () => void;
  hasUnsaved: () => boolean;
}

interface Options<D> {
  save: (draft: D) => Promise<void>;
  /** Demonstration mode: nothing saves and the state says so. */
  demo: boolean;
  /** The session's connection is offline. */
  offline: boolean;
  /** When the document was last saved, for "Saved 2 hours ago" on opening. */
  savedAt: number | null;
  /**
   * The screen went away (a browser Back, say) with a change that then didn't
   * save. The screen is gone, so whoever is still on screen says so (§5 #25:
   * a failure on leaving is never silent). `retry` saves the same draft again.
   */
  onLostOnLeave: (retry: () => Promise<boolean>) => void;
}

const offlineFailure = (err: unknown) =>
  (err instanceof WriteError && err.code === "offline") ||
  (typeof navigator !== "undefined" && navigator.onLine === false);

/**
 * The document's autosave (R5), wired to the page: it saves when the tab is
 * hidden or the page is closing, asks the browser to warn before closing with
 * a change that hasn't landed, tries again when the connection comes back, and
 * saves what's left when the screen goes away.
 */
export function useDocAutosave<D>({ save, demo, offline, savedAt, onLostOnLeave }: Options<D>): DocAutosave<D> {
  const [saver] = useState(() => new DocSaver<D>({ save, isOffline: offlineFailure, savedAt }));
  const state = useSyncExternalStore(saver.subscribe, saver.getState, saver.getState);
  const lostRef = useRef(onLostOnLeave);
  useEffect(() => {
    saver.saveWith(save);
    lostRef.current = onLostOnLeave;
  });

  // Back online after a failed save: try it again, as the note promised.
  useEffect(() => {
    if (!offline && (saver.state.kind === "offline" || saver.state.kind === "failed")) void saver.retry();
  }, [offline, saver]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && saver.hasUnsaved) void saver.flush();
    };
    // Best effort: the page may be gone before the write lands. The browser's own question covers the rest.
    const onPageHide = () => {
      if (saver.hasUnsaved) void saver.flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!saver.hasUnsaved) return;
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [saver]);

  // Leaving the screen: save what's left, and say so if it doesn't land.
  useEffect(() => {
    saver.revive();
    return () => {
      const unsaved = saver.hasUnsaved;
      saver.dispose();
      if (!unsaved) return;
      void saver.flush().then((ok) => {
        if (!ok) lostRef.current(() => saver.flush());
      });
    };
  }, [saver]);

  const change = useCallback((draft: D) => (demo ? undefined : saver.change(draft)), [demo, saver]);
  const flush = useCallback(() => (demo ? Promise.resolve(true) : saver.flush()), [demo, saver]);
  const retry = useCallback(() => void saver.retry(), [saver]);
  const abandon = useCallback(() => saver.abandon(), [saver]);
  const hasUnsaved = useCallback(() => !demo && saver.hasUnsaved, [demo, saver]);

  const kind: DocSaveKind = demo ? "demo" : state.kind;
  return useMemo(
    () => ({ kind, savedAt: state.savedAt, change, flush, retry, abandon, hasUnsaved }),
    [kind, state.savedAt, change, flush, retry, abandon, hasUnsaved],
  );
}
