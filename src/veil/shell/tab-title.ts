"use client";

import { useEffect } from "react";
import { screenOfTitle, tabTitle } from "@/lib/model/app-identity";

/**
 * Makes the tab follow the names in the top bar (guide §4.31; Phase 8 review S4, G1). Each page
 * titles itself "*screen* · Our wedding planner" (its metadata, or the document screen's own
 * title); whenever the head's title takes that form this swaps the app's name for the names, and
 * puts it back when the names go or the top bar unmounts. Its own swap isn't in that form, so it
 * doesn't run again.
 */
export function useTabTitle(names: string | null) {
  useEffect(() => {
    let screen: string | null = null;
    const apply = () => {
      const read = screenOfTitle(document.title);
      if (read !== undefined) screen = read;
      if (screen === null) return;
      const next = tabTitle(screen, names);
      if (document.title !== next) document.title = next;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (screen !== null) document.title = tabTitle(screen, null);
    };
  }, [names]);
}
