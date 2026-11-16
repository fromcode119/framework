import type { ReactNode, RefObject } from 'react';
import { PureReactor, prop, state, bound, ref } from '@fromcode119/react-class-components';
import { StructuredReadOnlyCell } from '@/components/collection/fields/view/structured-read-only-cell.client';
import type { IStructuredNode } from '@/components/collection/fields/interfaces/structured-node.interface';
import { StructuredReadOnlyTableService } from '@/components/collection/fields/structured-read-only-table-service';
import { StructuredReadOnlyFieldService } from '@/components/collection/fields/structured-read-only-field-service';
import { FrameworkIcons } from '@fromcode119/react';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { Input } from '@/components/ui/view/input.client';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { FiltersButton } from '@/components/ui/list-toolbar/view/filters-button.client';
import { StructuredReadOnlyTableFoot } from '@/components/collection/fields/view/structured-read-only-table-foot.client';
import { StructuredTableFilterBar } from '@/components/collection/fields/view/structured-table-filter-bar.client';
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
  /** What the section's own search holds, already lower-cased; empty shows every row. */
  @prop declare searchLower?: string;

  /**
   * Where the section's head keeps room for this table's controls. The toolbar is rendered by the
   * table, which is the only thing that knows its columns, and then moved into that room — the card's
   * head is above the field in the page, so a field cannot render into it from where it stands.
   */
  @prop declare toolbarTarget?: HTMLElement;
  @ref declare private toolsRef: RefObject<HTMLDivElement | null>;
  @state private search = '';

  componentDidMount(): void {
    this.placeTools();
  }

  componentDidUpdate(): void {
    this.placeTools();
  }

  /** Keeps the toolbar in the head the section offered it, once React has drawn both. */
  private placeTools(): void {
    const tools = this.toolsRef.current;
    if (!tools || !this.toolbarTarget || tools.parentElement === this.toolbarTarget) return;
    this.toolbarTarget.appendChild(tools);
  }

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
    return StructuredReadOnlyTableService.filterableColumns(this.node, this.toolbarTarget ? 2 : undefined).map((entry) => new ListFilter(
      entry.column,
      StructuredReadOnlyFieldService.keyLabel(entry.column, this.keyLabels),
      [{ label: AdminI18n.t('collection.list.filterAll'), value: '' }, ...entry.values.map((value) => ({ label: value, value }))],
      this.picked[entry.column] ?? '',
      '',
      (value: string) => { this.picked = { ...this.picked, [entry.column]: value }; this.page = 1; },
    ));
  }

  /** Drops one column's filter, leaving the rest of the narrowing alone. */
  @bound private clearFilter(column: string): void {
    this.picked = { ...this.picked, [column]: '' };
    this.page = 1;
  }

  /** Drops every filter at once — the way back to the whole table from a narrowed one. */
  @bound private clearFilters(): void {
    this.picked = {};
    this.page = 1;
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
    this.page = 1;
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
          <button type="button" aria-label={label} title={label} className="fc-sro-table__menu">
            <FrameworkIcons.More size={16} />
          </button>
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
    if (!this.toolbarTarget) {
      return filters.length ? <div className="fc-sro-table__tools"><FiltersButton filters={filters} total={total} /></div> : null;
    }
    const label = AdminI18n.t('shell.nav.search');
    const sortLabel = AdminI18n.t('collection.list.sortBy');
    const sortOptions = StructuredReadOnlyTableService.columnsFor(this.node)
      .filter((column) => !this.node.tableMediaColumns?.includes(column))
      .map((column) => ({
        label: StructuredReadOnlyFieldService.keyLabel(column, this.keyLabels),
        icon: this.sortColumn === column
          ? (this.sortDescending ? <FrameworkIcons.ArrowDown size={14} /> : <FrameworkIcons.ArrowUp size={14} />)
          : undefined,
        onClick: () => this.sortBy(column),
      }));
    return (
      <div className="fc-sro-table__tools" ref={this.toolsRef}>
        {filters.length ? <FiltersButton compact filters={filters} total={total} /> : null}
        {sortOptions.length ? (
          <Dropdown align={HorizontalAlign.RIGHT} items={sortOptions} trigger={
            <button type="button" className="fc-sro-table__tool" aria-label={sortLabel} title={sortLabel}>
              <FrameworkIcons.List size={15} />
            </button>
          } />
        ) : null}
        {/* The console's own field, so the table's search is the one height and look every list has. */}
        <Input
          size={FieldSize.SM}
          type="search"
          value={this.search}
          aria-label={label}
          placeholder={label}
          onChange={(event: any) => { this.search = String(event?.target?.value ?? ''); this.page = 1; }}
          className="fc-sro-table__search-field"
        />
      </div>
    );
  }

  render(): ReactNode {
    const columns = StructuredReadOnlyTableService.columnsFor(this.node);
    const all = this.node.tableRows ?? [];
    const needle = (this.toolbarTarget ? this.search : this.searchLower ?? '').trim().toLowerCase();
    const matching = needle ? all.filter((row) => StructuredReadOnlyTableService.tableRowMatches(row, needle, columns)) : all;
    const rows = this.ordered(this.narrowed(matching));
    const size = this.toolbarTarget ? 10 : StructuredReadOnlyTable.PAGE_SIZE;
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const page = Math.min(this.page, pages);
    const shown = rows.slice((page - 1) * size, page * size);
    const toolbar = this.renderTools(rows.length);
    const media = this.node.tableMediaColumns ?? [];
    return (
      <div className="fc-sro-table">
        {toolbar}
        {/* What the table is narrowed to, on a line of its own under its toolbar — held even when
            nothing is picked, so turning a filter on does not shift the rows under the pointer. */}
        {this.toolbarTarget
          ? <StructuredTableFilterBar picked={this.picked} keyLabels={this.keyLabels}
              onClear={this.clearFilter} onClearAll={this.clearFilters} />
          : null}
        <div className="fc-sro-table__scroll">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  media.includes(column) && this.toolbarTarget
                    ? <th key={column} className="fc-sro-table__media-cell" aria-label={StructuredReadOnlyFieldService.keyLabel(column, this.keyLabels)} />
                    :
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
              {!shown.length ? (
                <tr><td colSpan={columns.length + (this.editRow ? 1 : 0)}>{AdminI18n.t('ui.structured.noMatch')}</td></tr>
              ) : null}
              {shown.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => (
                    <td key={column} className={media.includes(column) ? 'fc-sro-table__media-cell' : undefined}>
                      <StructuredReadOnlyCell node={row[column]} media={media.includes(column)} />
                    </td>
                  ))}
                  {this.editRow ? <td className="fc-sro-table__menu-cell">{this.renderRowMenu()}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <StructuredReadOnlyTableFoot
          from={rows.length ? (page - 1) * size + 1 : 0}
          to={(page - 1) * size + shown.length}
          total={rows.length}
          page={page}
          pages={pages}
          onPage={this.goToPage}
          showPager={Boolean(this.toolbarTarget)}
        />
      </div>
    );
  }
}
