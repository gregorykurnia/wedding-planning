import { useState } from "react";

/**
 * What an input shows while it is being typed in. It follows `value` whenever
 * that changes (a save that landed, or your partner's edit) and otherwise keeps
 * what was typed, so a change that didn't save is still there to try again.
 */
export function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return [draft, setDraft] as const;
}
