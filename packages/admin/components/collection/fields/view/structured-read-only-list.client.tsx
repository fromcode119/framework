import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

/**
 * A list of plain values — slugs, codes, names — as a row of chips, the way a tag field shows its
 * tags. Numbering each one (`[0] koleda`, `[1] figuri`) as its own row made a short list read like a
 * data dump; the position carries no meaning the operator needs.
 */
export class StructuredReadOnlyList extends PureReactor {
  @prop declare node: IStructuredNode;

  render(): ReactNode {
    return (
      <div className="fc-sro__chips">
        {(this.node.items ?? []).map((item, index) => (
          <span key={index} className="fc-sro__chip">{String(item.scalarValue)}</span>
        ))}
      </div>
    );
  }
}
