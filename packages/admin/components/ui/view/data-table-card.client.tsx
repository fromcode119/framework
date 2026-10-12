import type { MouseEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { Checkbox } from '@/components/ui/view/checkbox.client';
import { Column } from '@/components/ui/column';

/**
 * One {@link DataTable} row on a narrow screen, laid out like a collection list card: the first column is
 * the title, every other column reads under it with its heading, and the row's actions sit at the bottom.
 */
export class DataTableCard<T extends { id: any }> extends PureReactor {
  declare props: Pick<DataTableCard<T>, 'row' | 'columns' | 'selectable' | 'selected' | 'onToggleOne' | 'onRowClick' | 'actions'>;

  @prop declare row: T;
  @prop declare columns: Column<T>[];
  @prop declare selectable?: boolean;
  @prop declare selected?: boolean;
  @prop declare onToggleOne?: (id: string, event: MouseEvent) => void;
  @prop declare onRowClick?: (row: T) => void;
  @prop declare actions?: (row: T) => ReactNode;

  @bound private open(): void {
    this.onRowClick?.(this.row);
  }

  @bound private toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.onToggleOne?.(String(this.row.id), event);
  }

  @bound private stop(event: MouseEvent): void {
    event.stopPropagation();
  }

  private value(column: Column<T>): ReactNode {
    const { row } = this;
    return typeof column.accessor === 'function' ? column.accessor(row) : String(row[column.accessor] ?? '');
  }

  /** A column with nothing to say ('' / '-' / '—' / null) is left off the card instead of printing its heading alone. */
  private static isEmpty(value: ReactNode): boolean {
    return value === null || value === undefined || value === false || (typeof value === 'string' && ['', '-', '—'].includes(value.trim()));
  }

  private renderDetails(columns: Column<T>[]): ReactNode {
    const parts = columns
      .map((column) => ({ column, value: this.value(column) }))
      .filter(({ value }) => !DataTableCard.isEmpty(value));
    if (!parts.length) return null;
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-slate-600 dark:text-slate-300">
        {parts.map(({ column, value }) => (
          <span key={column.id} className="inline-flex min-w-0 max-w-full items-center gap-1.5">
            {column.header ? <span className="shrink-0 text-slate-400 dark:text-slate-500">{column.header}</span> : null}
            <span className="min-w-0">{value}</span>
          </span>
        ))}
      </div>
    );
  }

  render(): ReactNode {
    const [titleColumn, ...rest] = this.columns;
    const actions = this.actions?.(this.row);
    return (
      <div
        className={`flex gap-3 pl-3 pr-4 py-3 border-t border-slate-100 dark:border-slate-800/70 first:border-t-0 ${this.onRowClick ? 'cursor-pointer' : ''} ${this.selected ? 'bg-indigo-50/60 dark:bg-indigo-500/10' : ''}`}
        onClick={this.open}
      >
        {this.selectable ? (
          <button type="button" onClick={this.toggle} aria-pressed={this.selected} className="shrink-0 self-start p-1 -m-0.5">
            <Checkbox checked={this.selected} presentational />
          </button>
        ) : null}
        <div className="flex-1 min-w-0">
          {titleColumn ? (
            <div className="min-w-0 text-[14px] font-semibold leading-snug text-slate-900 dark:text-slate-100">{this.value(titleColumn)}</div>
          ) : null}
          {this.renderDetails(rest)}
          {actions ? <div className="mt-2 flex flex-wrap items-center justify-end gap-2" onClick={this.stop}>{actions}</div> : null}
        </div>
      </div>
    );
  }
}
