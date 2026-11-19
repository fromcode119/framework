import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * A few words about a control, shown while the pointer rests on it or the keyboard is on it.
 *
 * It is drawn on the document, not inside the control's own box, so a card that clips its content
 * cannot cut it off; a tap shows it too, since a phone has no hover; its place is taken from where the control stands at that moment. It names or
 * explains — it is never the only place something is said.
 */
export class Tooltip extends PureReactor {
  @prop declare content: ReactNode;
  @prop declare children: ReactNode;
  /** Above the control unless told otherwise. */
  @prop declare side?: 'top' | 'bottom';

  @state private at: { x: number; y: number } | null = null;

  private static readonly GAP = 8;
  private static readonly HALF = 160;

  @bound private show(event: { currentTarget: HTMLElement }): void {
    const box = event.currentTarget.getBoundingClientRect();
    const below = this.side === 'bottom';
    // Kept a half-width from each edge of the window, so words about a control at the side stay on screen.
    const reach = Math.min(Tooltip.HALF, window.innerWidth / 2 - Tooltip.GAP);
    const middle = Math.min(Math.max(box.left + box.width / 2, reach + Tooltip.GAP), window.innerWidth - reach - Tooltip.GAP);
    this.at = { x: middle, y: below ? box.bottom + Tooltip.GAP : box.top - Tooltip.GAP };
  }

  @bound private hide(): void {
    this.at = null;
  }

  render(): ReactNode {
    const name = AdminClass.of('tooltip');
    return (
      <span className={`${name}__anchor`} onMouseEnter={this.show} onMouseLeave={this.hide} onFocus={this.show} onBlur={this.hide} onClick={this.show}>
        {this.children}
        {this.at && this.content
          ? createPortal(
              <span role="tooltip" className={name} data-side={this.side || 'top'} style={{ left: this.at.x, top: this.at.y }}>
                {this.content}
              </span>,
              document.body,
            )
          : null}
      </span>
    );
  }
}
