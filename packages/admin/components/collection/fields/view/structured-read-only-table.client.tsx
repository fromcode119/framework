import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StructuredReadOnlyValue } from '@/components/collection/fields/view/structured-read-only-value.client';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';

/**
 * Renders an `array-table` node — an array whose items are all flat objects — as an actual table
 * whose columns are the union of the objects' keys. This is what makes a timeline or a changelog
 * (a `status` + `at` per entry, a list of line items) scannable instead of a wall of repeated keys.
 */
export class StructuredReadOnlyTable extends PureReactor {
  @prop declare node: IStructuredNode;
  @prop declare isDark?: boolean;

  render(): ReactNode {
    const { node, isDark } = this;
    const columns = node.tableColumns ?? [];
    const rows = node.tableRows ?? [];
    const headerClass = `border-b px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`;
    const cellClass = `px-3 py-2 align-top text-[11px] ${isDark ? 'border-slate-900' : 'border-slate-100'} border-b`;

    return (
      <div className={`overflow-x-auto rounded-lg border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((column) => <th key={column} className={headerClass}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
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
