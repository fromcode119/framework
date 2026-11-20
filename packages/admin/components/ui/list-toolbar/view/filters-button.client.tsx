import type { ReactNode } from 'react';
import { PureReactor, prop, bound, ref } from '@fromcode119/react-class-components';
import type { Ref } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ListFilter } from '@/components/ui/list-toolbar/list-filter';
import { FilterPanel } from '@/components/ui/list-toolbar/view/filter-panel.client';
import { Dropdown } from '@/components/ui/view/dropdown.client';
import { HorizontalAlign } from '@/components/ui/enums/horizontal-align.enum';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One Filters button instead of a dropdown per filter. It counts the filters in force, so a narrowed
 * list says so even with the panel closed. The panel is a Dropdown like the column chooser and the
 * order beside it: drawn above the list, so the list's card cannot clip it.
 */
export class FiltersButton extends PureReactor {
  declare props: Pick<FiltersButton, 'filters' | 'total' | 'compact'>;

  @prop declare filters: readonly ListFilter[];
  /** Rows the current filters match, for the panel's closing button. */
  @prop declare total: number;
  @prop declare compact?: boolean;

  @ref declare private dropdown: Ref<Dropdown>;

  @bound private close(): void {
    if (this.dropdown.current) this.dropdown.current.isOpen = false;
  }

  private get activeCount(): number {
    return this.filters.filter((filter) => filter.isActive).length;
  }

  render(): ReactNode {
    const activeCount = this.activeCount;
    return (
      <div className="shrink-0">
        <Dropdown
          ref={this.dropdown}
          align={HorizontalAlign.LEFT}
          items={[]}
          trigger={
            // The console's one quiet toolbar control, like the column chooser and the order beside it.
            // Below 640px the word is dropped and the funnel carries it (the label still names it).
            <span
              title={AdminI18n.t('ui.listToolbar.filters')}
              aria-label={AdminI18n.t('ui.listToolbar.filters')}
              className={this.compact ? 'fc-sro-table__tool' : `fc-toolbar-btn${activeCount > 0 ? ' fc-toolbar-btn--active' : ''}`}
            >
              <FrameworkIcons.Filter size={15} />
              {this.compact ? null : <span className="hidden sm:inline">{AdminI18n.t('ui.listToolbar.filters')}</span>}
              {activeCount ? <span className="fc-toolbar-btn__count">{activeCount}</span> : null}
            </span>
          }
          panel={<FilterPanel filters={this.filters} total={this.total} onClose={this.close} />}
        />
      </div>
    );
  }
}
