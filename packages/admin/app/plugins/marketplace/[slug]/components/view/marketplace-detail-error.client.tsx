import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class MarketplaceDetailError extends PureReactor {
  @prop declare error: string | null;
  @prop declare onBack: () => void;

  render(): ReactNode {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
           <FrameworkIcons.Alert size={40} className="text-red-500" />
        </div>
        <h2 className="text-xl font-semibold">{AdminI18n.t('plugins.list.error')}</h2>
        <p className="text-slate-500">{this.error || AdminI18n.t('plugins.list.pluginNotFound')}</p>
        <button onClick={this.onBack} className="text-indigo-600 font-semibold hover:underline">
          {AdminI18n.t('plugins.list.backToMarketplace')}
        </button>
      </div>
    );
  }
}
