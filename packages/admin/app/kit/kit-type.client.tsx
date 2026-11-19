import { Kbd } from '@/components/ui/view/kbd.client';
import type { ReactNode } from 'react';
import { PureReactor } from '@fromcode119/react-class-components';
import { RecordCard } from '@/components/ui/view/record-card.client';

/** The kit's type: one line per role, each in the class that role is drawn with. */
export class KitType extends PureReactor {
  render(): ReactNode {
    return (
      <RecordCard title="Typography" id="kit-typography">
        <div className="fc-kit__type">
          <h1 className="fc-record-head__title">Record title</h1>
          <h2 className="fc-record-card__title">Card title</h2>
          <span className="fc-field-label">Field label</span>
          <span className="fc-record-card__label">Row label</span>
          <span className="fc-record-card__value">Row value</span>
          <p className="fc-field-note">A note under a field, or a hint.</p>
          <Kbd>⌘K</Kbd>
        </div>
      </RecordCard>
    );
  }
}
