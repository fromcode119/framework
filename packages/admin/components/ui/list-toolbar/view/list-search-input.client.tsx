import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { SearchField } from '@/components/ui/view/search-field.client';

/** The search field at the head of a list. It filters as you type; the list decides what it matches. */
export class ListSearchInput extends PureReactor {
  declare props: Pick<ListSearchInput, 'value' | 'onSearch' | 'placeholder' | 'theme' | 'onScan'>;

  @prop declare value: string;
  @prop declare onSearch: (value: string) => void;
  @prop declare placeholder: string;
  @prop declare theme: ThemeMode;
  /** Turns on the scan button; the code read is already the search when this is called. */
  @prop declare onScan?: (code: string) => void;

  render(): ReactNode {
    return <SearchField className="flex-1 min-w-0" value={this.value} onChange={this.onSearch} placeholder={this.placeholder} onScan={this.onScan} />;
  }
}
