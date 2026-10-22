/**
 * Which answers a live collection read believes (P6-S15, P7-S14). Pure, apart
 * from the session's record of collections the server has answered, so the
 * hook and the tests share it.
 */

/** Collections the server has answered at least once since the page loaded. */
const synced = new Set<string>();

export interface Answer {
  /** The collection read. */
  name: string;
  /** Whether this read has believed an answer yet. */
  arrived: boolean;
  fromCache: boolean;
  empty: boolean;
  /** Whether any document was added, changed or removed (not only its metadata). */
  changed: boolean;
  /** `navigator.onLine`. */
  online: boolean;
}

/**
 * What to do with one snapshot: `hold` keeps waiting, `skip` keeps what is
 * shown (only the metadata moved), `take` shows it. An empty answer from the
 * cache while offline, before anything arrived, says "nothing has arrived", not
 * "there is nothing", unless the server has already answered for that
 * collection this session: then the cache is what the server said. A held read
 * is released by the server's own answer (`fromCache` false), even an empty
 * one, never by the connection coming back alone.
 */
export function readAnswer(answer: Answer): "hold" | "skip" | "take" {
  if (!answer.fromCache) synced.add(answer.name);
  if (!answer.arrived) {
    const unknown = answer.fromCache && answer.empty && !answer.online && !synced.has(answer.name);
    return unknown ? "hold" : "take";
  }
  return answer.changed ? "take" : "skip";
}

/** For the tests: forget what the server has answered. */
export function forgetSynced() {
  synced.clear();
}
