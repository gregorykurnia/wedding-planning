import type { DocSaveKind } from "@/lib/model/documents";

/** The pause in typing before a document saves (tokens.css `--time-autosave-pause`). */
export const AUTOSAVE_PAUSE_MS = 900;

export interface SaverState {
  kind: Exclude<DocSaveKind, "demo">;
  /** When the last save landed, in epoch ms; null until one has. */
  savedAt: number | null;
}

export interface DocSaverOptions<D> {
  /** Writes the draft. Rejecting keeps it, to be tried again. `saveWith` replaces it. */
  save: (draft: D) => Promise<void>;
  /** Whether a failure means "you're offline" rather than "couldn't save". */
  isOffline: (err: unknown) => boolean;
  delayMs?: number;
  now?: () => number;
  /** The state to start in: an existing document reads as saved when it was last edited. */
  savedAt?: number | null;
}

/**
 * The autosave of one document (guide §4.24, §6.1, R5). It never drops a
 * change: the newest draft is kept until a save of it has landed.
 *
 * - `change(draft)`: Not saved yet, then a save after a pause in typing.
 * - Saves run one at a time. A change made while one is in flight saves after it.
 * - A failure keeps the draft and says Couldn't save (or offline). It isn't retried
 *   on its own: Try again, the next change or `retry()` (when the connection is
 *   back) try it again.
 * - `flush()` saves now and resolves true once everything has landed, false if
 *   the last try failed. Leaving the document waits for it.
 */
export class DocSaver<D> {
  private latest: D | null = null;
  private dirty = false;
  private running = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private current: SaverState;
  private listeners = new Set<() => void>();
  private save: (draft: D) => Promise<void>;

  constructor(private readonly opts: DocSaverOptions<D>) {
    this.current = { kind: "saved", savedAt: opts.savedAt ?? null };
    this.save = opts.save;
  }

  get state(): SaverState {
    return this.current;
  }

  /** Calls `listener` after every change of state; returns the way to stop. */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.current;

  /** The write to use from now on (the screen's latest). */
  saveWith(save: (draft: D) => Promise<void>) {
    this.save = save;
  }

  /** A change that hasn't landed: not saved yet, saving, or failed. */
  get hasUnsaved(): boolean {
    return this.dirty || this.running > 0;
  }

  /** The newest draft that hasn't landed, or null when everything is saved. */
  get unsavedDraft(): D | null {
    return this.hasUnsaved ? this.latest : null;
  }

  change(draft: D) {
    if (this.disposed) return;
    this.latest = draft;
    this.dirty = true;
    this.set({ kind: "unsaved" });
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.opts.delayMs ?? AUTOSAVE_PAUSE_MS);
  }

  /** Saves what hasn't been saved, now. True once everything has landed. */
  flush(): Promise<boolean> {
    this.clearTimer();
    const next = this.queue.then(() => this.attempt());
    this.queue = next.catch(() => {});
    return next;
  }

  /** Try again: the same as `flush`, for a failed save. */
  retry(): Promise<boolean> {
    return this.flush();
  }

  /** Forgets every change that hasn't landed: leaving without them, or a deleted document. */
  abandon() {
    this.dirty = false;
    this.latest = null;
    this.dispose();
  }

  dispose() {
    this.disposed = true;
    this.clearTimer();
  }

  /** Back in use after `dispose` (React mounts effects twice in development). */
  revive() {
    this.disposed = false;
  }

  private async attempt(): Promise<boolean> {
    if (!this.dirty || this.latest === null) return this.current.kind === "saved";
    // Runs after `dispose` too: leaving the screen still saves what's left.
    const draft = this.latest;
    this.dirty = false;
    this.running++;
    this.set({ kind: "saving" });
    try {
      await this.save(draft);
      this.running--;
      if (this.dirty) {
        // Typed while it saved: that newer change is still to save.
        this.set({ kind: "unsaved" });
        if (!this.disposed && !this.timer) {
          this.timer = setTimeout(() => {
            this.timer = null;
            void this.flush();
          }, this.opts.delayMs ?? AUTOSAVE_PAUSE_MS);
        }
        return false;
      }
      this.set({ kind: "saved", savedAt: (this.opts.now ?? Date.now)() });
      return true;
    } catch (err) {
      this.running--;
      // The draft that failed is still the newest unless a change came since; either way it's kept.
      this.dirty = true;
      this.set({ kind: this.opts.isOffline(err) ? "offline" : "failed" });
      return false;
    }
  }

  private set(next: Partial<SaverState> & { kind: SaverState["kind"] }) {
    this.current = { savedAt: this.current.savedAt, ...next };
    if (!this.disposed) this.listeners.forEach((listener) => listener());
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
