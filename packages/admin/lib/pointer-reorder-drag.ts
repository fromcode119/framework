/**
 * Reordering things by dragging them with a pointer — mouse, pen or finger alike.
 *
 * The browser's own drag-and-drop (`draggable`) never worked on touch screens and gave no reliable
 * feedback about where an item would land. This follows the pointer instead: press, move a few pixels,
 * and the item under the pointer (the nearest element carrying `attribute`) becomes the target; release
 * drops the dragged item there. Whether the pointer is in the lower half of the target is reported too,
 * so a list can place the item before or after it. Escape cancels.
 */
export class PointerReorderDrag {
  /** How far the pointer must travel before a press becomes a drag, so a plain click never moves anything. */
  private static readonly THRESHOLD_PX = 6;

  private key = '';
  private over = '';
  private after = false;
  private startX = 0;
  private startY = 0;
  private active = false;

  constructor(
    private readonly attribute: string,
    private readonly onChange: (dragKey: string, overKey: string, after: boolean) => void,
    private readonly onDrop: (dragKey: string, overKey: string, after: boolean) => void,
    /** Presses on the item's own controls (buttons, links, fields) are left alone — unless the press IS on the handle. */
    private readonly ignoreControls = true,
  ) {}

  start(key: string, event: { clientX: number; clientY: number; button: number; target: EventTarget | null }): void {
    if (event.button !== 0) return;
    if (this.ignoreControls && (event.target as Element | null)?.closest?.('button, a, input, select, textarea')) return;
    this.key = key;
    this.over = '';
    this.after = false;
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
      if (Math.hypot(event.clientX - this.startX, event.clientY - this.startY) < PointerReorderDrag.THRESHOLD_PX) return;
      this.active = true;
    }
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(`[${this.attribute}]`);
    const over = target ? String(target.getAttribute(this.attribute) || '') : '';
    this.over = over === this.key ? '' : over;
    const box = this.over ? target?.getBoundingClientRect?.() : undefined;
    this.after = Boolean(box && box.height && event.clientY > box.top + box.height / 2);
    this.onChange(this.key, this.over, this.after);
  };

  private end = (): void => {
    const { key, over, after, active } = this;
    this.stop();
    if (active && over) this.onDrop(key, over, after);
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
    this.after = false;
    this.active = false;
    this.onChange('', '', false);
  }
}
