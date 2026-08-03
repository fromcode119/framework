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
          <StatCard
            title="Users"
            value={this.loadingStats ? "..." : this.userCount}
            icon={<FrameworkIcons.Users size={20} />}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Plugin Extensions"
            value={String(this.activePluginsCount)}
            icon={<FrameworkIcons.Plugins size={20} />}
            trend={{ value: 5, isPositive: true }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <Slot name="admin.dashboard.stats" />
        </div>
      </>
    );
  }
}
