import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
import { StatCard } from '@/components/ui/view/stat-card.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class DashboardStatsGrid extends PureReactor {
  @prop declare userCount: string;
  @prop declare loadingStats: boolean;
  @prop declare activePluginsCount: number;

  render(): ReactNode {
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* No `trend` is passed: neither the collection-stats endpoint (users) nor the active-plugins
              endpoint returns a historical series, so any percentage here would be invented. A trend chip
              may only return alongside a real prior-period figure from the API. */}
          <StatCard
            title={AdminI18n.t('nav.items.users')}
            value={this.loadingStats ? "..." : this.userCount}
            icon={<FrameworkIcons.Users size={20} />}
          />
          <StatCard
            title={AdminI18n.t('dashboard.pluginExtensions')}
            value={String(this.activePluginsCount)}
            icon={<FrameworkIcons.Plugins size={20} />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <Slot name="admin.dashboard.stats" />
        </div>
      </>
    );
  }
}
