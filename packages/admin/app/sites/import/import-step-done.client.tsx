import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';

/**
 * A finished step, as one line.
 *
 * The archive picker and the identity form are each a full card, and they stayed full cards after
 * they were answered — so the plan, which is the only thing left to read, opened below two screens
 * of spent form. A step that is done says what it was answered with and offers the way back.
 */
export class ImportStepDone extends PureReactor {
  @prop declare title: string;
  @prop declare value: string;
  @prop declare actionLabel: string;
  @prop declare onAction: () => void;

  render(): ReactNode {
    return (
      <div className="fc-import-step">
        <span className="fc-import-step__tick" aria-hidden="true">{'✓'}</span>
        <b className="fc-import-step__title">{this.title}</b>
        <span className="fc-import-step__value">{this.value}</span>
        <button type="button" className="fc-import-step__action" onClick={this.onAction}>{this.actionLabel}</button>
      </div>
    );
  }
}
