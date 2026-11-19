import type { ReactNode } from 'react';
import { PureReactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ListFilter } from '@/components/ui/list-toolbar/list-filter';
import { FilterPanel } from '@/components/ui/list-toolbar/view/filter-panel.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * One Filters button instead of a dropdown per filter. It counts the filters in force, so a narrowed
 * list says so even with the panel closed.
 */
export class FiltersButton extends PureReactor {
  declare props: Pick<FiltersButton, 'filters' | 'total' | 'compact'>;

  @prop declare filters: readonly ListFilter[];
  /** Rows the current filters match, for the panel's closing button. */
  @prop declare total: number;
  @prop declare compact?: boolean;

  @state open = false;

  @bound private toggle(): void {
    this.open = !this.open;
  }

  @bound private close(): void {
    this.open = false;
  }

  private get activeCount(): number {
    return this.filters.filter((filter) => filter.isActive).length;
  }

  render(): ReactNode {
    const activeCount = this.activeCount;
    const active = this.open || activeCount > 0;
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={this.toggle}
          aria-expanded={this.open}
          title={AdminI18n.t('ui.listToolbar.filters')}
          aria-label={AdminI18n.t('ui.listToolbar.filters')}
          // The console's one quiet toolbar control, like the column chooser and the order beside it —
          // not the hand-mixed `bg-white border-slate-200` that made the three sit together in three
          // different greys. Below 640px the word is dropped and the funnel carries it (the aria-label
          // still names it), so a phone shows a labelled control, not a bare square.
          className={this.compact ? 'fc-sro-table__tool' : `fc-toolbar-btn${active ? ' fc-toolbar-btn--active' : ''}`}
        >
          <FrameworkIcons.Filter size={15} />
          {this.compact ? null : <span className="hidden sm:inline">{AdminI18n.t('ui.listToolbar.filters')}</span>}
          {activeCount ? <span className="fc-toolbar-btn__count">{activeCount}</span> : null}
        </button>
        {this.open ? <FilterPanel filters={this.filters} total={this.total} onClose={this.close} /> : null}
      </div>
    );
  }
}
