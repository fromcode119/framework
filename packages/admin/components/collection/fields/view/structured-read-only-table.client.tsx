import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { StructuredReadOnlyCell } from '@/components/collection/fields/view/structured-read-only-cell.client';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';
import { StructuredReadOnlyTableService } from '@/components/collection/fields/structured-read-only-table-service';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import { FrameworkIcons } from '@fromcode119/react';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { FiltersButton } from '@/components/ui/list-toolbar/view/filters-button.client';
import { StructuredReadOnlyTableFoot } from '@/components/collection/fields/view/structured-read-only-table-foot.client';
import { ListFilter } from '@/components/ui/list-toolbar/list-filter';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Renders an `array-table` node — an array whose items are all flat objects — as an actual table
 * whose columns are the union of the objects' keys. This is what makes a timeline or a changelog
 * (a `status` + `at` per entry, a list of line items) scannable instead of a wall of repeated keys.
 * Headed like every other table of the console (`fc-sro-table` in `admin.css`).
 */
export class StructuredReadOnlyTable extends PureReactor {
  @prop declare node: IStructuredNode;
  @prop declare keyLabels?: Record<string, string>;
  /** The columns to draw, in order — the owning field's `admin.tableColumns`. Empty draws every column. */
  @prop declare columns?: readonly string[];
  /** The columns that hold a picture, as the field declared them. */
  @prop declare media?: readonly string[];
  /** What the section's own search holds, already lower-cased; empty shows every row. */
  @prop declare searchLower?: string;

  /** How many rows are read at once, after which the table pages. */
  private static readonly PAGE_SIZE = 20;

  @state private page = 1;

  /**
   * Opens the editor this value is changed in. Given one, every row ends in a ⋯ offering it — the way
   * into the row from the row itself, instead of back up to the card's head. It is the SECTION's editor:
   * the value is one field of the record, so the sheet opens it whole, and the menu says nothing else.
   */
  @prop declare editRow?: () => void;

  /** The value picked per column; a column with no entry is not narrowed. */
  @state private picked: Record<string, string> = {};

  /**
   * The filters this table offers — one per column that holds more than one value and not too many.
   * Built with the console's own {@link ListFilter}, so the panel, the chips and the counting are the
   * same ones every list in the console uses.
   */
  private get filters(): ListFilter[] {
    return StructuredReadOnlyTableService.filterableColumns(this.node, this.columns).map((entry) => new ListFilter(
      entry.column,
      StructuredReadOnlyFieldService.keyLabel(entry.column, this.keyLabels),
      [{ label: AdminI18n.t('collection.list.filterAll'), value: '' }, ...entry.values.map((value) => ({ label: value, value }))],
      this.picked[entry.column] ?? '',
      '',
      (value: string) => { this.picked = { ...this.picked, [entry.column]: value }; },
    ));
  }

  /** The rows left once every picked value is honoured. */
  private narrowed(rows: Array<Record<string, IStructuredNode>>): Array<Record<string, IStructuredNode>> {
    const picked = Object.entries(this.picked).filter(([, value]) => value);
    if (!picked.length) return rows;
    return rows.filter((row) => picked.every(([column, value]) => StructuredReadOnlyTableService.cellText(row[column]).trim() === value));
  }

  /** The column the operator sorted by, and which way. Empty means the order the record holds. */
  @state private sortColumn = '';
  @state private sortDescending = false;

  /**
   * A table is sorted by pressing the name of a column — once for up, again for down, a third time
   * back to the order the record itself holds. Nothing is stored: it is how this table is being read
   * now, not a setting, and the next record opens as the record has it.
   */
  @bound private sortBy(column: string): void {
    if (this.sortColumn !== column) {
      this.sortColumn = column;
      this.sortDescending = false;
      return;
    }
    if (!this.sortDescending) {
      this.sortDescending = true;
      return;
    }
    this.sortColumn = '';
    this.sortDescending = false;
  }

  /** Rows in the order they are read: the record's own, or the column the operator pressed. */
  private ordered(rows: Array<Record<string, IStructuredNode>>): Array<Record<string, IStructuredNode>> {
    const column = this.sortColumn;
    if (!column) return rows;
    const text = (row: Record<string, IStructuredNode>): string => StructuredReadOnlyTableService.cellText(row[column]);
    const sorted = [...rows].sort((left, right) => text(left).localeCompare(text(right), undefined, { numeric: true, sensitivity: 'base' }));
    return this.sortDescending ? sorted.reverse() : sorted;
  }

  /** One ⋯ per row, the same one on each: what this row can be asked for is to be edited. */
  private renderRowMenu(): ReactNode {
    const open = this.editRow;
    if (!open) return null;
    const label = AdminI18n.t('collection.edit.editSection');
    return (
      <Dropdown
        align={HorizontalAlign.RIGHT}
        items={[{ label, onClick: open, icon: <FrameworkIcons.Edit size={14} /> }]}
        trigger={
          <span role="button" tabIndex={0} aria-label={label} title={label} className="fc-sro-table__menu">
            <FrameworkIcons.More size={16} />
          </span>
        }
      />
    );
  }

  @bound private goToPage(next: number): void {
    this.page = next;
  }

  /**
   * What narrows this table, beyond the search its SECTION carries in its head: a filter per column
   * worth offering one. The search is the section's because it belongs beside the section's name, the
   * way every list in the console carries it, and a field cannot reach up into the head to put it there.
   */
  private renderTools(total: number): ReactNode {
    const filters = this.filters;
    if (!filters.length) return null;
    return <div className="fc-sro-table__tools"><FiltersButton filters={filters} total={total} /></div>;
  }

  render(): ReactNode {
    const columns = StructuredReadOnlyTableService.columnsFor(this.node, this.columns);
    const all = this.node.tableRows ?? [];
    const needle = String(this.searchLower || '').trim();
    const matching = needle ? all.filter((row) => StructuredReadOnlyTableService.tableRowMatches(row, needle, columns)) : all;
    const rows = this.ordered(this.narrowed(matching));
    const size = StructuredReadOnlyTable.PAGE_SIZE;
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const page = Math.min(this.page, pages);
    const shown = rows.slice((page - 1) * size, page * size);
    const toolbar = this.renderTools(rows.length);
    return (
      <div className="fc-sro-table">
        {toolbar}
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} aria-sort={this.sortColumn === column ? (this.sortDescending ? 'descending' : 'ascending') : 'none'}>
                  <button type="button" className="fc-sro-table__sort" onClick={() => this.sortBy(column)}>
                    {StructuredReadOnlyFieldService.keyLabel(column, this.keyLabels)}
                    {this.sortColumn === column ? <span aria-hidden="true">{this.sortDescending ? ' ↓' : ' ↑'}</span> : null}
                  </button>
                </th>
              ))}
              {this.editRow ? <th className="fc-sro-table__menu-head" aria-label="" /> : null}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td key={column} className={this.media?.includes(column) ? 'fc-sro-table__media-cell' : undefined}>
                    <StructuredReadOnlyCell node={row[column]} media={this.media?.includes(column)} />
                  </td>
                ))}
                {this.editRow ? <td className="fc-sro-table__menu-cell">{this.renderRowMenu()}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
        <StructuredReadOnlyTableFoot
          from={rows.length ? (page - 1) * size + 1 : 0}
          to={(page - 1) * size + shown.length}
          total={rows.length}
          page={page}
          pages={pages}
          onPage={this.goToPage}
        />
      </div>
    );
  }
}
