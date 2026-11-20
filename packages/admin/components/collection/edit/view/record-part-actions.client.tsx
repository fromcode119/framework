import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IRecordPartAction } from '@/components/collection/edit/interfaces/record-part-action.interface';
import { RecordPartActionButton } from '@/components/collection/edit/view/record-part-action-button.client';

/**
 * What can be started from this record, beside the part it concerns: refund under the payments, a
 * shipment or a return under the delivery.
 *
 * Each is offered by the plugin that would carry it out and opens that plugin's own screen. Nothing
 * here changes anything by itself.
 */
export class RecordPartActions extends PureReactor {
  @prop declare actions: IRecordPartAction[];
  @prop declare onOpen: (href: string) => void;

  render(): ReactNode {
    if (!this.actions?.length) return null;
    return (
      <div className="fc-record-part__actions">
        {this.actions.map((action) => <RecordPartActionButton key={action.id} action={action} onOpen={this.onOpen} />)}
      </div>
    );
  }
}
