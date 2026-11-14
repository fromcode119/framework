import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { StructuredReadOnlyValue } from '@/components/collection/fields/view/structured-read-only-value.client';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';

/**
 * Renders an `array-table` node — an array whose items are all flat objects — as an actual table
 * whose columns are the union of the objects' keys. This is what makes a timeline or a changelog
 * (a `status` + `at` per entry, a list of line items) scannable instead of a wall of repeated keys.
 * Headed like every other table of the console (`fc-sro-table` in `admin.css`).
 */
export class StructuredReadOnlyTable extends PureReactor {
  @prop declare node: IStructuredNode;
  @prop declare keyLabels?: Record<string, string>;

  render(): ReactNode {
    const columns = this.node.tableColumns ?? [];
    const rows = this.node.tableRows ?? [];
    return (
      <div className="fc-sro-table">
        <table>
          <thead>
            <tr>
              {columns.map((column) => <th key={column}>{StructuredReadOnlyFieldService.keyLabel(column, this.keyLabels)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => <td key={column}><StructuredReadOnlyValue node={row[column]} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
