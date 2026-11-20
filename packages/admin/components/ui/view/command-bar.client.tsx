import { OverlayPresence } from '@/components/ui/overlay-presence';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminClass } from '@/lib/admin-class';

/**
 * What can be done to the rows that are selected: a dark bar at the foot of the window, there while
 * something is selected and gone when nothing is. It says how many (`value`) and then lists what can
 * be done (`CommandBarCommand`), so the actions stay in one place however far the list is scrolled.
 */
export class CommandBar extends PureReactor {
  @prop declare open: boolean;
  /** "3 selected". */
  @prop declare value: ReactNode;
  @prop declare children: ReactNode;
  @prop declare className?: string;

  /** Keeps it drawn while it leaves — see OverlayPresence. */
  private presence = new OverlayPresence(() => this.forceUpdate());

  componentWillUnmount(): void {
    this.presence.dispose();
  }

  render(): ReactNode {
    const shown = typeof document === 'undefined' ? null : this.presence.state(this.open);
    if (!shown) return null;
    const name = AdminClass.of('command-bar');
    return this.portal(
      <div className={`${name} ${this.className ?? ''}`} data-state={shown} role="toolbar">
        <div className={`${name}__bar`}>
          <div className={`${name}__value`}>{this.value}</div>
          {this.children}
        </div>
      </div>,
      document.body,
    );
  }
}
