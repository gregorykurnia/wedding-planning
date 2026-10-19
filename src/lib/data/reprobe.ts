/** How often an account let in on trust is probed again while the page shows. */
export const REPROBE_MS = 30_000;

interface Targets {
  window: Pick<Window, "addEventListener" | "removeEventListener">;
  document: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">;
}

/**
 * Calls `probe` when the device comes back online, when the page shows again,
 * and on a timer while it shows. `navigator.onLine` alone misses a captive
 * portal or a database that timed out with the browser still "online" (Phase 2
 * review S1). Returns the stop. `probe` decides whether there is anything to ask.
 */
export function watchReprobe(probe: () => void, targets: Targets = { window, document }): () => void {
  const { window: win, document: doc } = targets;
  const timer = setInterval(() => {
    if (doc.visibilityState === "visible") probe();
  }, REPROBE_MS);
  const onVisibility = () => {
    if (doc.visibilityState === "visible") probe();
  };
  win.addEventListener("online", probe);
  doc.addEventListener("visibilitychange", onVisibility);
  return () => {
    clearInterval(timer);
    win.removeEventListener("online", probe);
    doc.removeEventListener("visibilitychange", onVisibility);
  };
}
