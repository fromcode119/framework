import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardPointerDrag } from '@/lib/dashboard/dashboard-pointer-drag';

/** Dragging a widget with the pointer: a press that moves becomes a drag; release drops it on the widget under it. */
describe('DashboardPointerDrag', () => {
  const widget = (key: string) => { const el = document.createElement('div'); el.setAttribute('data-widget-key', key); return el; };
  const press = (drag: DashboardPointerDrag, target: EventTarget = document.body) => drag.start('a', { clientX: 10, clientY: 10, button: 0, target });
  const pointer = (type: string, x: number, y: number) => window.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { clientX: x, clientY: y }));

  afterEach(() => vi.restoreAllMocks());

  it('drops the dragged widget on the widget under the pointer', () => {
    const onDrop = vi.fn();
    const drag = new DashboardPointerDrag(() => undefined, onDrop);
    (document as any).elementFromPoint = vi.fn(() => widget('b'));
    press(drag);
    pointer('pointermove', 60, 10);
    pointer('pointerup', 60, 10);
    expect(onDrop).toHaveBeenCalledWith('a', 'b');
  });

  it('treats a press that barely moves as a click, not a drag', () => {
    const onDrop = vi.fn();
    const drag = new DashboardPointerDrag(() => undefined, onDrop);
    (document as any).elementFromPoint = vi.fn(() => widget('b'));
    press(drag);
    pointer('pointermove', 12, 11);
    pointer('pointerup', 12, 11);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('leaves presses on a widget’s own buttons alone', () => {
    const onDrop = vi.fn();
    const drag = new DashboardPointerDrag(() => undefined, onDrop);
    (document as any).elementFromPoint = vi.fn(() => widget('b'));
    press(drag, document.createElement('button'));
    pointer('pointermove', 80, 10);
    pointer('pointerup', 80, 10);
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('reports the target while dragging and clears it when done', () => {
    const onChange = vi.fn();
    const drag = new DashboardPointerDrag(onChange, () => undefined);
    (document as any).elementFromPoint = vi.fn(() => widget('c'));
    press(drag);
    pointer('pointermove', 60, 10);
    expect(onChange).toHaveBeenLastCalledWith('a', 'c');
    pointer('pointerup', 60, 10);
    expect(onChange).toHaveBeenLastCalledWith('', '');
  });
});
