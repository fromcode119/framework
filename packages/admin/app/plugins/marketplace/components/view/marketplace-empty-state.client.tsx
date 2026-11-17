import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminLink } from '@/components/view/admin-link.client';

export class MarketplaceEmptyState extends PureReactor {
  /** False when no marketplace is set: the list is empty because nothing is being read, not because the catalogue is. */
  @prop declare configured: boolean;

  render(): ReactNode {
    return (
      <div className="col-span-full">
        <EmptyState
          icon={<FrameworkIcons.Plugins size={22} />}
          title={AdminI18n.t(this.configured ? 'plugins.list.noPluginsFound' : 'plugins.list.noMarketplaceSet')}
          hint={AdminI18n.t(this.configured ? 'plugins.list.tryADifferentSearchTerm' : 'plugins.list.noMarketplaceSetHelp')}
          action={this.configured ? null : (
            <AdminLink href={AdminConstants.ROUTES.SETTINGS.GENERAL} className="fc-empty__link">
              {AdminI18n.t('plugins.list.openGeneralSettings')}
            </AdminLink>
          )}
        />
      </div>
    );
  }
}
