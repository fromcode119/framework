import React from 'react';
import { Slot } from '@fromcode119/react';
import { StatCard } from '@/components/ui/stat-card';
import { FrameworkIcons } from '@fromcode119/react';
import type { DashboardStatsGridProps } from './dashboard-stats-grid.interfaces';

export class DashboardStatsGrid extends React.Component<DashboardStatsGridProps> {
  render(): React.ReactNode {
    const { userCount, loadingStats, activePluginsCount } = this.props;
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Users"
            value={loadingStats ? "..." : userCount}
            icon={<FrameworkIcons.Users size={20} />}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Plugin Extensions"
            value={String(activePluginsCount)}
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
