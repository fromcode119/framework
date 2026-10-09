import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

/**
 * A list of plain values — slugs, codes, names — as a row of chips, the way a tag field shows its
 * tags. Numbering each one (`[0] koleda`, `[1] figuri`) as its own labelled block made a short list
 * read like a data dump; the position carries no meaning the operator needs.
 */
export class StructuredReadOnlyList extends PureReactor {
  @prop declare node: IStructuredNode;
  @prop declare isDark?: boolean;

  render(): ReactNode {
    const chipClass = this.isDark
      ? 'border-slate-700 bg-slate-900 text-slate-200'
      : 'border-slate-200 bg-white text-slate-700';
    return (
      <div className="flex flex-wrap gap-1.5">
        {(this.node.items ?? []).map((item, index) => (
          <span key={index} className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[12px] font-medium break-all ${chipClass}`}>
            {String(item.scalarValue)}
          </span>
        ))}
      </div>
    );
  }
}
