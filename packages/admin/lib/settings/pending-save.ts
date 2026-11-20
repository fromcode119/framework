import { PendingSaves } from '@/lib/settings/pending-saves';

/**
 * One card's unsaved values, as the page's save bar sees them.
 *
 * The card gives three things: how to read its values now, how to write them, and how to put a set of
 * values back. `mark()` records "this is what is stored" — after a load and after a write that worked.
 */
export class PendingSave {
  private baseline: string | null = null;
  private ok = true;

  constructor(
    private readonly current: () => unknown,
    private readonly write: () => Promise<void>,
    private readonly restore: (values: any) => void,
  ) {
    PendingSaves.add(this);
  }

  /** What is on screen now is what is stored. */
  mark(): void {
    this.baseline = JSON.stringify(this.current());
    PendingSaves.changed();
  }

  /** Called by the card when its write was refused, so the values stay unsaved. */
  failed(): void {
    this.ok = false;
  }

  get dirty(): boolean {
    return this.baseline !== null && JSON.stringify(this.current()) !== this.baseline;
  }

  async save(): Promise<void> {
    this.ok = true;
    await this.write();
    if (this.ok) this.mark();
  }

  discard(): void {
    if (this.baseline !== null) this.restore(JSON.parse(this.baseline));
  }

  dispose(): void {
    PendingSaves.remove(this);
  }
}
