"use client";

import { useEffect } from "react";

/**
 * On a phone the toolbar is docked at the bottom (guide §4.24). When the
 * keyboard opens, iOS doesn't shrink the layout, so a fixed bar would sit
 * under the keyboard. This keeps `--keyboard-inset` on the page at the height the
 * keyboard covers, read from `visualViewport`, and the toolbar's CSS lifts
 * itself by it. Elsewhere it stays 0.
 */
export function useKeyboardDock() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        root.style.setProperty("--keyboard-inset", `${Math.round(covered)}px`);
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);
}
