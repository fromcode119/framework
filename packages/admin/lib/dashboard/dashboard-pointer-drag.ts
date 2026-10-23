import { PointerReorderDrag } from '@/lib/pointer-reorder-drag';

/**
 * Reordering dashboard widgets by dragging them. The whole widget is the handle: press anywhere on it
 * (except its own buttons and links), move, and release over another widget to take its place.
 */
export class DashboardPointerDrag extends PointerReorderDrag {
  constructor(onChange: (dragKey: string, overKey: string) => void, onDrop: (dragKey: string, overKey: string) => void) {
    super('data-widget-key', (dragKey, overKey) => onChange(dragKey, overKey), (dragKey, overKey) => onDrop(dragKey, overKey));
  }
}
