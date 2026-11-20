import type { KeyboardEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { GripVertical } from 'lucide-react';

/**
 * The handle a RepeatRow is moved by: dragged with the mouse, or focused and moved with the arrow keys,
 * so a row can be reordered without a column of arrow buttons. `onMove` gets the arrow key pressed and
 * answers the row's new place (or null when it did not move); focus follows the row there.
 */
export class RepeatRowGrip extends PureReactor {
  @prop declare label: string;
  @prop declare onMove: (key: string) => number | null;
  /** The pointer is on the handle: the row may be dragged only while it is. */
  @prop declare onHover?: (on: boolean) => void;

  private static readonly KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  @bound private onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!RepeatRowGrip.KEYS.includes(event.key)) return;
    event.preventDefault();
    const rows = event.currentTarget.closest('.fc-repeat__rows');
    const to = this.onMove(event.key);
    if (to === null || !rows) return;
    requestAnimationFrame(() => (rows.querySelectorAll<HTMLElement>('.fc-repeat__tool--grip')[to])?.focus());
  }

  render(): ReactNode {
    return (
      <button
        type="button"
        className="fc-repeat__tool fc-repeat__tool--grip"
        title={this.label}
        aria-label={this.label}
        onKeyDown={this.onKeyDown}
        onMouseEnter={() => this.onHover?.(true)}
        onMouseLeave={() => this.onHover?.(false)}
      >
        <GripVertical size={14} />
      </button>
    );
  }
}
