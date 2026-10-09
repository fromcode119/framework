import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import type { IDropdownItem } from '@/components/ui/interfaces/dropdown-item.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The list's order as a menu. Column headers already sort, but a phone shows cards, not headers, and
 * there the order would otherwise be out of reach. Offers exactly the columns the API can order by.
 */
export class SortMenu extends PureReactor {
  declare props: Pick<SortMenu, 'columns' | 'sort' | 'onSort'>;

  @prop declare columns: readonly { id: string; header: string; sortable?: boolean }[];
  /** `name` ascending, `-name` descending. */
  @prop declare sort: string;
  @prop declare onSort: (sort: string) => void;

  private get field(): string {
    return this.sort.replace(/^-/, '');
  }

  private get descending(): boolean {
    return this.sort.startsWith('-');
  }

  private get items(): IDropdownItem[] {
    const sortBy = AdminI18n.t('collection.list.sortBy');
    const order = AdminI18n.t('collection.list.sortOrder');
    const byColumn: IDropdownItem[] = this.columns.filter((column) => column.sortable).map((column, index) => ({
      label: column.header,
      section: index === 0 ? sortBy : undefined,
      selectable: true,
      selected: column.id === this.field,
      onClick: () => this.onSort(this.descending ? `-${column.id}` : column.id),
    }));
    return [
      ...byColumn,
      { label: AdminI18n.t('collection.list.sortDescending'), section: order, selectable: true, selected: this.descending, onClick: () => this.onSort(`-${this.field}`) },
      { label: AdminI18n.t('collection.list.sortAscending'), selectable: true, selected: !this.descending, onClick: () => this.onSort(this.field) },
    ];
  }

  render(): ReactNode {
    const current = this.columns.find((column) => column.id === this.field);
    const Icon = this.descending ? ArrowDownWideNarrow : ArrowUpNarrowWide;
    return (
      <Dropdown
        align={HorizontalAlign.RIGHT}
        items={this.items}
        trigger={
          <span
            title={AdminI18n.t('collection.list.sortBy')}
            className="h-11 px-3.5 rounded-xl border text-sm font-semibold inline-flex items-center gap-2 leading-none shadow-sm transition-all bg-white border-slate-200 text-slate-700 hover:border-indigo-400 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-200 dark:hover:border-indigo-500/60"
          >
            <Icon size={15} />
            <span className="hidden lg:inline max-w-[9rem] truncate">{current?.header || AdminI18n.t('collection.list.sortBy')}</span>
          </span>
        }
      />
    );
  }
}
