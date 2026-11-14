import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StructuredReadOnlyValue } from '@/components/collection/fields/view/structured-read-only-value.client';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

/**
 * One recorded value as a label / value row — the same row a saved record's card lists its own fields
 * in, so a value the runtime recorded reads exactly like one an operator typed. The look is `admin.css`
 * (`fc-sro__row`, sharing the record card's grid and rule).
 */
export class StructuredReadOnlyBlock extends PureReactor {
  @prop declare label: string;
  @prop declare node: IStructuredNode;
  @prop declare keyLabels?: Record<string, string>;

  render(): ReactNode {
    return (
      <div className="fc-sro__row">
        <dt className="fc-sro__label">{StructuredReadOnlyFieldService.keyLabel(this.label, this.keyLabels)}</dt>
        <dd className="fc-sro__value"><StructuredReadOnlyValue node={this.node} /></dd>
      </div>
    );
  }
}
