import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StructuredReadOnlyValue } from '@/components/collection/fields/view/structured-read-only-value.client';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';

/**
 * Renders an `array-table` node — an array whose items are all flat objects — as an actual table
 * whose columns are the union of the objects' keys. This is what makes a timeline or a changelog
 * (a `status` + `at` per entry, a list of line items) scannable instead of a wall of repeated keys.
 */
export class StructuredReadOnlyTable extends PureReactor {
  @prop declare node: IStructuredNode;
  @prop declare isDark?: boolean;
  @prop declare keyLabels?: Record<string, string>;

  render(): ReactNode {
    const { node, isDark, keyLabels } = this;
    const columns = node.tableColumns ?? [];
    const rows = node.tableRows ?? [];
    const headerClass = `border-b px-0 pr-5 pb-2 text-left text-[9px] font-bold uppercase tracking-[0.09em] ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`;
    const cellClass = `px-0 pr-5 py-2.5 align-top text-[12px] font-medium last:pr-0 ${isDark ? 'border-slate-800' : 'border-slate-200'} border-b`;

    return (
      // No border and no width cap: the control's own recessed panel is the frame, and a second one
      // made the status history read as a table inside a table inside a card.
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} className={headerClass}>{StructuredReadOnlyFieldService.keyLabel(column, keyLabels)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="last:[&>td]:border-b-0">
                {columns.map((column) => (
                  <td key={column} className={cellClass}>
                    <StructuredReadOnlyValue node={row[column]} isDark={isDark} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
