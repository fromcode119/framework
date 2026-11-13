import { AsyncDataController } from '@react/async-data-controller';
import type { IDebouncedSearchCallbacks } from '@react/interfaces/debounced-search-callbacks.interface';

/**
 * The typed text, asked of the server once the operator pauses.
 *
 * Every picker whose options come from a collection needs the same three things, and three plugins were
 * about to write them again: wait for a pause instead of reading on every keystroke, ignore a slow
 * earlier answer that lands after a newer one ({@link AsyncDataController} already does that), and say
 * while a read is in flight that the list is not the answer yet.
 *
 * It knows nothing about what is being searched: the owner supplies the read and receives the rows.
 */
export class DebouncedSearchController<T> {
  static readonly DEFAULT_DELAY_MS = 250;

  private readonly data = new AsyncDataController<T>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastTerm: string | null = null;

  constructor(
    private readonly read: (term: string) => Promise<T>,
    private readonly callbacks: IDebouncedSearchCallbacks<T>,
    private readonly delayMs: number = DebouncedSearchController.DEFAULT_DELAY_MS,
  ) {}

  /** The first page, asked for at once — a menu that has not been typed in yet still has a list. */
  start(): void {
    void this.run('');
  }

  /** The typed text. Repeating what was last asked for asks nothing. */
  search(term: string): void {
    const next = String(term ?? '').trim();
    if (this.timer !== null) clearTimeout(this.timer);
    if (next === this.lastTerm) return;
    this.timer = setTimeout(() => void this.run(next), this.delayMs);
  }

  /** Nothing pending is asked for, and no answer still in flight is applied. */
  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.data.cancel();
  }

  private async run(term: string): Promise<void> {
    this.lastTerm = term;
    await this.data.load(() => this.read(term), {
      onStart: () => this.callbacks.onSearching?.(true),
      // An answer that never came is not an empty collection: the owner keeps what it had.
      onSuccess: (rows) => { this.callbacks.onResult(rows, term); this.callbacks.onSearching?.(false); },
      onError: (error) => { this.callbacks.onError?.(error, term); this.callbacks.onSearching?.(false); },
    });
  }
}
