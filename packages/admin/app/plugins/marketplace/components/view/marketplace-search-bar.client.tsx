import { SearchField } from '@/components/ui/view/search-field.client';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { Input } from '@/components/ui/view/input.client';

export class MarketplaceSearchBar extends PureReactor {
  /** JSX props — the declared @prop fields, so call sites are type-checked without a <Props> generic. */
  declare props: Pick<MarketplaceSearchBar, 'theme' | 'searchQuery' | 'onChange'>;

  @prop declare theme: ThemeMode;
  @prop declare searchQuery: string;
  @prop declare onChange: (value: string) => void;

  render(): ReactNode {
    const { theme, searchQuery, onChange } = this;
    return (
      <SearchField className="flex-1" placeholder={AdminI18n.t('plugins.list.searchGlobalMarketplace')} value={searchQuery} onChange={onChange} />
    );
  }
}
