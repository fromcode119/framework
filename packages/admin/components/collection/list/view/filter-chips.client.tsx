import type { ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { ListFilter } from '@/components/collection/list/list-filter';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The filters in force, one chip each, so a filtered list never looks like the whole collection. A
 * chip's × removes that filter. On a phone the row scrolls sideways instead of wrapping.
 */
export class FilterChips extends PureReactor {
  declare props: Pick<FilterChips, 'filters'>;

  @prop declare filters: readonly ListFilter[];

  private get active(): ListFilter[] {
    return this.filters.filter((filter) => filter.isActive);
  }

  @bound private clearAll(): void {
    for (const filter of this.active) filter.reset();
  }

  render(): ReactNode {
    const active = this.active;
    if (!active.length) return null;
    return (
      <div className="flex items-center gap-2 overflow-x-auto sm:flex-wrap [scrollbar-width:none]">
        {active.map((filter) => (
          <span
            key={filter.key}
            className="shrink-0 inline-flex items-center gap-1.5 h-7 pl-3 pr-1.5 rounded-full whitespace-nowrap text-[12px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
          >
            {filter.label}: {filter.valueLabel}
            <button
              type="button"
              onClick={() => filter.reset()}
              aria-label={AdminI18n.t('collection.list.removeFilter', { label: filter.label })}
              className="w-5 h-5 rounded-full inline-flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-500/25"
            >
              <FrameworkIcons.X size={12} />
            </button>
          </span>
        ))}
        <button type="button" onClick={this.clearAll} className="shrink-0 whitespace-nowrap text-[12px] font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400">
          {AdminI18n.t('collection.list.clearFilters')}
        </button>
      </div>
    );
  }
}
