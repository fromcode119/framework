import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';

/**
 * What can be started from this record, beside the part it concerns: refund under the payments, a
 * shipment or a return under the delivery.
 *
 * Each is offered by the plugin that would carry it out and opens that plugin's own screen. Nothing
 * here changes anything by itself.
 */
export class RecordPartActions extends PureReactor {
  @prop declare actions: Array<{ id: string; label: string; href: string; icon?: string }>;
  @prop declare onOpen: (href: string) => void;

  render(): ReactNode {
    if (!this.actions?.length) return null;
    return (
      <div className="fc-record-part__actions">
        {this.actions.map((action) => {
          const Icon = action.icon ? FrameworkIcons.getIcon(action.icon) : null;
          return (
            <button key={action.id} type="button" className="fc-record-part__button" onClick={() => this.onOpen(action.href)}>
              {Icon ? <Icon size={14} /> : null}
              {action.label}
            </button>
          );
        })}
      </div>
    );
  }
}
