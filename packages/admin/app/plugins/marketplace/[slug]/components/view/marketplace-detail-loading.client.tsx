import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class MarketplaceDetailLoading extends PureReactor {
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const theme = this.theme;
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <span className="fc-loader__ring fc-loader__ring--page" aria-hidden="true" />
        <p className={`text-sm font-medium ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`}>
          {AdminI18n.t('plugins.list.loadingPluginDetails')}
        </p>
      </div>
    );
  }
}
