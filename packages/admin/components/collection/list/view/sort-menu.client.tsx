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
          // The order, like the column chooser beside it: a quiet icon square in the one toolbar look.
          // The chosen column shows in the menu, not on the button, so the three controls stay the
          // same width instead of one of them growing a 9rem label.
          <span title={`${AdminI18n.t('collection.list.sortBy')}${current?.header ? ` — ${current.header}` : ''}`} className="fc-toolbar-btn fc-toolbar-btn--icon">
            <Icon size={15} />
          </span>
        }
      />
    );
  }
}
