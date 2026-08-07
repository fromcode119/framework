import type { ReactNode } from 'react';

import { PureReactor, prop } from '@fromcode119/reactor';
import { Slot } from '@fromcode119/react';
import { StatCard } from '@/components/ui/view/stat-card.client';
import { FrameworkIcons } from '@fromcode119/react';

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
            title="Users"
            value={this.loadingStats ? "..." : this.userCount}
            icon={<FrameworkIcons.Users size={20} />}
          />
          <StatCard
            title="Plugin Extensions"
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
