import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StructuredReadOnlyValue } from '@/components/collection/fields/view/structured-read-only-value.client';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

/**
 * One label-above-value pair — the unit the whole control is built from.
 *
 * The label sits ABOVE rather than in a fixed left column because a left column has to be wide enough
 * for the longest key on the record ("Shipping charged separately") and every short value then sits
 * alone in whatever is left. Measured on an order: a 190px label column left a 946px value column
 * holding the word `true`. Stacking lets three or four pairs share a row instead.
 */
export class StructuredReadOnlyBlock extends PureReactor {
  /** Beyond this many characters a value earns the full row rather than one column of it. */
  private static readonly WIDE_VALUE_THRESHOLD = 44;

  @prop declare label: string;
  @prop declare node: IStructuredNode;
  @prop declare isDark?: boolean;
  @prop declare keyLabels?: Record<string, string>;

  /**
   * An address or a URL in a one-third column wraps to four ragged lines while the pairs beside it
   * hold two characters. Long values take the whole row; the grid stays even for everything else.
   */
  private get spanClass(): string {
    const value = this.node?.scalarValue;
    const text = value === null || value === undefined ? '' : String(value);
    return text.length > StructuredReadOnlyBlock.WIDE_VALUE_THRESHOLD ? 'col-span-full' : '';
  }

  render(): ReactNode {
    const { label, node, isDark, keyLabels } = this;
    return (
      <div className={`min-w-0 ${this.spanClass}`}>
        <div className={`mb-1 text-[9px] font-bold uppercase tracking-[0.09em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {StructuredReadOnlyFieldService.keyLabel(label, keyLabels)}
        </div>
        <div className="text-[13px] font-medium leading-snug">
          <StructuredReadOnlyValue node={node} isDark={isDark} />
        </div>
      </div>
    );
  }
}
