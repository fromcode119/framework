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
  declare props: Pick<FiltersButton, 'filters' | 'total'>;

  @prop declare filters: readonly ListFilter[];
  /** Rows the current filters match, for the panel's closing button. */
  @prop declare total: number;

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

  private get buttonClass(): string {
    return this.open || this.activeCount
      ? 'bg-white border-indigo-400 text-slate-800 dark:bg-slate-900 dark:border-indigo-500/60 dark:text-slate-100'
      : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-200 dark:hover:border-indigo-500/60';
  }

  render(): ReactNode {
    const activeCount = this.activeCount;
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={this.toggle}
          aria-expanded={this.open}
          title={AdminI18n.t('ui.listToolbar.filters')}
          className={`h-11 px-3.5 rounded-xl border text-sm font-semibold inline-flex items-center gap-2 leading-none shadow-sm transition-all ${this.buttonClass}`}
        >
          <FrameworkIcons.Filter size={15} />
          <span className="hidden sm:inline">{AdminI18n.t('ui.listToolbar.filters')}</span>
          {activeCount ? <span className="min-w-5 h-5 px-1.5 rounded-full bg-indigo-600 text-white text-[11px] inline-flex items-center justify-center">{activeCount}</span> : null}
        </button>
        {this.open ? <FilterPanel filters={this.filters} total={this.total} onClose={this.close} /> : null}
      </div>
    );
  }
}
