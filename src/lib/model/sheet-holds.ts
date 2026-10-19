/**
 * Who is holding each open sheet (guide §6.2): a sheet is busy while any of
 * its writes is in flight, so a field save and an inline removal in the same
 * sheet each hold it, and one finishing doesn't release the other's hold.
 * Pure, so the host and the tests share it.
 */
export class SheetHolds {
  private held = new Map<number, Set<symbol>>();

  /**
   * Holds sheet `id` until the returned release runs. The release says true
   * when it let go of the sheet's last hold, so the host can re-check what it
   * left alone while the sheet was busy. Releasing twice does nothing.
   */
  hold(id: number): () => boolean {
    const token = Symbol();
    const holders = this.held.get(id) ?? new Set<symbol>();
    holders.add(token);
    this.held.set(id, holders);
    return () => {
      const current = this.held.get(id);
      if (!current?.delete(token) || current.size > 0) return false;
      this.held.delete(id);
      return true;
    };
  }

  busy(id: number): boolean {
    return this.held.has(id);
  }

  /** The sheet closed: its holds go with it, and a late release is ignored. */
  clear(id: number) {
    this.held.delete(id);
  }
}
