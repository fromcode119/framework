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
      <div className="relative flex-1 group">
        <FrameworkIcons.Search className="absolute start-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={16} />
        <Input
          type="text"
          placeholder={AdminI18n.t('plugins.list.searchGlobalMarketplace')}
          value={searchQuery}
          onChange={(e) => onChange(e.target.value)}
          inputClassName="ps-11"
        />
      </div>
    );
  }
}
