import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { StatePage } from '@/components/ui/view/state-page.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';

export class MarketplaceDetailError extends PureReactor {
  @prop declare error: string | null;
  @prop declare onBack: () => void;

  render(): ReactNode {
    return (
      <StatePage
        icon={<FrameworkIcons.Alert size={18} />}
        title={AdminI18n.t('plugins.list.error')}
        hint={this.error || AdminI18n.t('plugins.list.pluginNotFound')}
        actions={<Button variant={ButtonVariant.SECONDARY} onClick={this.onBack}>{AdminI18n.t('plugins.list.backToMarketplace')}</Button>}
      />
    );
  }
}
