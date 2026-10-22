/**
 * Runs moves and adds one after another, each from the positions the one before left, so three quick
 * Alt+↓ presses move a row three places (Phase 4 review S21) and an add doesn't take the gap a move
 * is still going into (Phase 6 review S8). The positions are kept until the list is read again
 * (Phase 7 review S6). A read that arrives while moves run can't drop them at once, so it marks them
 * stale and they are dropped when the queue goes idle; a move refused because the list changed drops
 * them too, so the next try starts from the list as read (Phase 8 review S1).
 * Pure, so the screen and the tests share it.
 */
export class MoveQueue<P> {
  private chain: Promise<unknown> = Promise.resolve();
  private placed: P | null = null;
  private stale = false;
  private failed = false;
  private running = 0;

  /**
   * `forget` says whether a failed write leaves the positions unknown: one that may still land, or
   * one refused because the list changed under it.
   */
  constructor(private readonly forget: (error: unknown) => boolean) {}

  /** Whether a move or add is still running. */
  get busy(): boolean {
    return this.running > 0;
  }

  /** The positions the last write left, or null when the next one starts from the list as read. */
  get positions(): P | null {
    return this.placed;
  }

  /** The list was read again: its positions take over, now or once the running writes settle. */
  read(): boolean {
    if (this.running > 0) {
      this.stale = true;
      return false;
    }
    this.placed = null;
    this.stale = false;
    return true;
  }

  /**
   * Queues `write`, which gets the positions to start from (`current()` when none are kept) and
   * returns the ones it leaves. `idle` runs when the queue empties, told whether a move failed.
   */
  run(write: (from: P) => Promise<P>, current: () => P, move: boolean, idle: (moveFailed: boolean) => void): Promise<void> {
    this.running += 1;
    const step = this.chain.then(async () => {
      this.placed = await write(this.placed ?? current());
    });
    this.chain = step.catch((error: unknown) => {
      if (move) this.failed = true;
      if (this.forget(error)) this.placed = null;
    });
    return step.finally(() => {
      this.running -= 1;
      if (this.running > 0) return;
      if (this.stale) this.placed = null;
      this.stale = false;
      const failed = this.failed;
      this.failed = false;
      idle(failed);
    });
  }
}
