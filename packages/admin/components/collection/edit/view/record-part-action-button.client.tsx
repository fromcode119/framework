import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import type { IRecordPartAction } from '@/components/collection/edit/interfaces/record-part-action.interface';

/**
 * One action another plugin offers from this record, as a button. An action that cannot be started now
 * stays where it would be, switched off, and says why — instead of vanishing and leaving the operator to
 * guess whether it exists at all.
 */
export class RecordPartActionButton extends PureReactor {
  @prop declare action: IRecordPartAction;
  @prop declare onOpen: (href: string) => void;

  render(): ReactNode {
    const action = this.action;
    const Icon = action.icon ? FrameworkIcons.getIcon(action.icon) : null;
    const reason = action.unavailable || undefined;
    return (
      <button type="button" className="fc-record-part__button" disabled={Boolean(reason)} title={reason}
        aria-description={reason} onClick={() => { if (!reason) this.onOpen(action.href); }}>
        {Icon ? <Icon size={14} /> : null}
        {action.label}
      </button>
    );
  }
}
