/**
 * Reordering dashboard widgets by dragging them, with a pointer — mouse, pen or finger alike.
 *
 * The browser's own drag-and-drop (`draggable`) was the first attempt: it only started from a small
 * bar, never worked on touch screens, and gave no reliable feedback about where the widget would land.
 * This follows the pointer instead: press on a widget, move a few pixels, and the widget under the
 * pointer becomes the target; release puts the dragged widget in that widget's place. Escape cancels.
 */
export class DashboardPointerDrag {
  /** How far the pointer must travel before a press becomes a drag, so a plain click never moves anything. */
  private static readonly THRESHOLD_PX = 6;

  private key = '';
  private over = '';
  private startX = 0;
  private startY = 0;
  private active = false;

  constructor(
    private readonly onChange: (dragKey: string, overKey: string) => void,
    private readonly onDrop: (dragKey: string, overKey: string) => void,
  ) {}

  /** Called from a widget's pointerdown. Presses on its own controls (buttons, links) are left alone. */
  start(key: string, event: { clientX: number; clientY: number; button: number; target: EventTarget | null }): void {
    if (event.button !== 0) return;
    if ((event.target as Element | null)?.closest?.('button, a, input, select, textarea')) return;
    this.key = key;
    this.over = '';
    this.active = false;
    this.startX = event.clientX;
    this.startY = event.clientY;
    window.addEventListener('pointermove', this.move);
    window.addEventListener('pointerup', this.end);
    window.addEventListener('pointercancel', this.cancel);
    window.addEventListener('keydown', this.escape);
  }

  private move = (event: PointerEvent): void => {
    if (!this.active) {
      if (Math.hypot(event.clientX - this.startX, event.clientY - this.startY) < DashboardPointerDrag.THRESHOLD_PX) return;
      this.active = true;
    }
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-widget-key]');
    const over = target ? String(target.getAttribute('data-widget-key') || '') : '';
    this.over = over === this.key ? '' : over;
    this.onChange(this.key, this.over);
  };

  private end = (): void => {
    const { key, over, active } = this;
    this.stop();
    if (active && over) this.onDrop(key, over);
  };

  private cancel = (): void => this.stop();

  private escape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.stop();
  };

  private stop(): void {
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.end);
    window.removeEventListener('pointercancel', this.cancel);
    window.removeEventListener('keydown', this.escape);
    this.key = '';
    this.over = '';
    this.active = false;
    this.onChange('', '');
  }
}
