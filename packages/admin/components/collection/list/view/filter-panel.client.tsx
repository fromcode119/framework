import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ListFilter } from '@/components/collection/list/list-filter';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * Every filter of the list in one place. Under the Filters button on a wide screen, a sheet from the
 * bottom on a phone. A filter applies the moment a value is picked, as the old dropdowns did; the
 * button at the bottom only closes the panel.
 */
export class FilterPanel extends PureReactor {
  declare props: Pick<FilterPanel, 'filters' | 'total' | 'onClose'>;

  @prop declare filters: readonly ListFilter[];
  /** Records the current filters match, for the button that closes the panel. */
  @prop declare total: number;
  @prop declare onClose: () => void;

  componentDidMount(): void {
    this.listen(document, 'keydown', this.handleKey);
  }

  @bound private handleKey(event: Event): void {
    if ((event as KeyboardEvent).key === 'Escape') this.onClose();
  }

  @bound private clearAll(): void {
    for (const filter of this.filters) if (filter.isActive) filter.reset();
  }

  private renderFilter(filter: ListFilter): ReactNode {
    return (
      <div key={filter.key} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
        <p className="mb-2 text-[12px] font-semibold text-slate-500 dark:text-slate-400">{filter.label}</p>
        <div className="flex flex-wrap gap-1.5">
          {filter.options.map((option) => {
            const chosen = option.value === filter.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={chosen}
                onClick={() => filter.apply(option.value)}
                className={`h-8 px-3 rounded-full border text-[12px] font-semibold transition-colors ${
                  chosen
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-500/60'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  render(): ReactNode {
    const anyActive = this.filters.some((filter) => filter.isActive);
    return (
      <>
        <div className="fixed inset-0 z-40 bg-slate-900/40 sm:bg-transparent" onClick={this.onClose} />
        <div
          role="dialog"
          aria-label={AdminI18n.t('collection.list.filters')}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] flex flex-col rounded-t-2xl border bg-white border-slate-200 shadow-2xl
            sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem] sm:max-h-[70vh] sm:rounded-2xl
            dark:bg-slate-900 dark:border-slate-800"
        >
          <div className="relative flex items-center justify-between px-4 pt-5 pb-3 sm:pt-3 border-b border-slate-200 dark:border-slate-800">
            <span className="absolute left-1/2 top-2 -translate-x-1/2 h-1 w-9 rounded-full bg-slate-300 dark:bg-slate-700 sm:hidden" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">{AdminI18n.t('collection.list.filters')}</span>
            {anyActive ? (
              <button type="button" onClick={this.clearAll} className="text-[12px] font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400">
                {AdminI18n.t('collection.list.clearFilters')}
              </button>
            ) : null}
          </div>
          <div className="overflow-y-auto">{this.filters.map((filter) => this.renderFilter(filter))}</div>
          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={this.onClose}
              className="w-full h-10 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <FrameworkIcons.Check size={15} />
              {AdminI18n.t('collection.list.showResults', { count: this.total })}
            </button>
          </div>
        </div>
      </>
    );
  }
}
