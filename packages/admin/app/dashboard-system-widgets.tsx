import type { ReactNode } from 'react';
import { DashboardWidgetSize } from '@fromcode119/core/client';
import { Slot } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { DashboardNeedsYou } from '@/app/dashboard-needs-you.client';
import { DashboardSitesPanel } from '@/app/dashboard-sites-panel.client';
import { DashboardRecentEdits } from '@/app/dashboard-recent-edits.client';
import { DashboardActivityFeed } from '@/app/dashboard-activity-feed';
import { DashboardActivityChart } from '@/app/dashboard-activity-chart';
import { DashboardSystemPanel } from '@/app/dashboard-system-panel.client';
import { DashboardActivityBreakdown } from '@/app/dashboard-activity-breakdown';
import { DashboardSupportCard } from '@/app/dashboard-support-card';
import type { IDashboardWidgetDefinition } from '@/lib/dashboard/interfaces/dashboard-widget-definition.interface';

/**
 * The console's own panels, offered as widgets like any plugin's. Listed in the order a fresh dashboard
 * shows them. The three slots plugins could fill before widgets existed are offered too — only when
 * something fills them — so an extension written against them keeps appearing, and can now be moved.
 */
export class DashboardSystemWidgets {
  private static readonly LEGACY_SLOTS = ['admin.dashboard.top', 'admin.dashboard.widgets', 'admin.dashboard.sidebar'];

  static definitions(input: {
    activity: any[];
    loadingActivity: boolean;
    scope: unknown;
    slots: Record<string, unknown[]>;
    onViewActivity: () => void;
    onNavigateFramework: () => void;
  }): IDashboardWidgetDefinition[] {
    const widget = (id: string, size: DashboardWidgetSize, render: () => ReactNode): IDashboardWidgetDefinition => ({
      key: `system.${id}`,
      label: AdminI18n.t(`dashboard.widgets.system.${id}.label`),
      description: AdminI18n.t(`dashboard.widgets.system.${id}.description`),
      source: '',
      size,
      defaultVisible: true,
      render,
    });
    const hasMain = (input.slots['admin.dashboard.main']?.length ?? 0) > 0;
    return [
      widget('needsYou', DashboardWidgetSize.LARGE, () => <DashboardNeedsYou />),
      widget('sites', DashboardWidgetSize.LARGE, () => <DashboardSitesPanel />),
      widget('recentEdits', DashboardWidgetSize.MEDIUM, () => <DashboardRecentEdits />),
      widget('activityChart', DashboardWidgetSize.SMALL, () => <DashboardActivityChart activity={input.activity} days={14} scope={input.scope} />),
      widget('activityFeed', DashboardWidgetSize.MEDIUM, () => (
        <DashboardActivityFeed activity={input.activity} loadingActivity={input.loadingActivity} hasMainContent={hasMain} onViewAll={input.onViewActivity} />
      )),
      widget('system', DashboardWidgetSize.SMALL, () => <DashboardSystemPanel />),
      widget('activityBreakdown', DashboardWidgetSize.SMALL, () => <DashboardActivityBreakdown activity={input.activity} />),
      widget('support', DashboardWidgetSize.SMALL, () => <DashboardSupportCard onNavigateFramework={input.onNavigateFramework} />),
      ...DashboardSystemWidgets.LEGACY_SLOTS
        .filter((slot) => (input.slots[slot]?.length ?? 0) > 0)
        .map((slot): IDashboardWidgetDefinition => ({
          key: `slot.${slot}`,
          label: AdminI18n.t('dashboard.widgets.legacy.label'),
          description: AdminI18n.t('dashboard.widgets.legacy.description', { slot }),
          source: '',
          size: DashboardWidgetSize.MEDIUM,
          defaultVisible: true,
          render: () => <div className="space-y-6"><Slot name={slot} /></div>,
        })),
    ];
  }
}
