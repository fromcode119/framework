/**
 * Lets something that opens over the page LEAVE as well as arrive.
 *
 * An overlay used to vanish between two frames the moment it was closed, because closing it was
 * rendering nothing. This keeps it drawn for the length of its exit, marked `closed`, so the same
 * stylesheet that brings it in takes it out (`[data-state="closed"]` in admin.css) — one place, for
 * every dialog, sheet, palette and bar.
 *
 * `state(open)` is asked once a render: `open` while it is open, `closed` while it leaves, and `null`
 * when there is nothing to draw.
 */
export class OverlayPresence {
  /** As long as --fc-dur-exit; the element is removed when its exit has run. */
  private static readonly EXIT_MS = 150;

  private live = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly redraw: () => void) {}

  private static get still(): boolean {
    return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  state(open: boolean): 'open' | 'closed' | null {
    if (open) {
      this.live = true;
      this.clear();
      return 'open';
    }
    if (!this.live) return null;
    if (OverlayPresence.still) {
      this.live = false;
      return null;
    }
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.live = false;
        this.redraw();
      }, OverlayPresence.EXIT_MS);
    }
    return 'closed';
  }

  /** Called when the owner goes away, so a late timer never redraws something that is gone. */
  dispose(): void {
    this.clear();
    this.live = false;
  }

  private clear(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
