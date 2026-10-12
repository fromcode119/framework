import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ListFilter } from '@/components/ui/list-toolbar/list-filter';
import { ListSearchInput } from '@/components/ui/list-toolbar/view/list-search-input.client';
import { FiltersButton } from '@/components/ui/list-toolbar/view/filters-button.client';
import { FilterChips } from '@/components/ui/list-toolbar/view/filter-chips.client';

/**
 * The head of any list in the admin: search, the Filters button, then whatever the list adds of its
 * own (a collection's Columns and Sort), with the filters in force underneath as chips. Every list
 * gets the same toolbar, so a filtered list reads the same everywhere and never looks like the whole.
 */
export class ListToolbar extends PureReactor {
  declare props: Pick<ListToolbar, 'search' | 'onSearch' | 'placeholder' | 'theme' | 'filters' | 'total' | 'children'>;

  @prop declare search: string;
  @prop declare onSearch: (value: string) => void;
  @prop declare placeholder: string;
  @prop declare theme: ThemeMode;
  @prop declare filters: readonly ListFilter[];
  /** Rows the search and filters currently match. */
  @prop declare total: number;
  /** The list's own controls, after the Filters button. */
  @prop declare children?: ReactNode;

  render(): ReactNode {
    return (
      <div className="flex flex-col gap-3 flex-1 w-full min-w-0">
        <div className="flex items-center gap-2 w-full min-w-0">
          <ListSearchInput value={this.search} onSearch={this.onSearch} placeholder={this.placeholder} theme={this.theme} />
          {this.filters.length ? <FiltersButton filters={this.filters} total={this.total} /> : null}
          {this.children}
        </div>
        <FilterChips filters={this.filters} />
      </div>
    );
  }
}
