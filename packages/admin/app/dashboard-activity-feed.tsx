import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { IconBadge } from '@/components/ui/view/icon-badge.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Slot } from '@fromcode119/react';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminI18n } from '@/lib/i18n/admin-i18n';
import { EmptyState } from '@/components/ui/view/empty-state.client';

export class DashboardActivityFeed extends PureReactor {
  @prop declare activity: any[];
  @prop declare loadingActivity: boolean;
  @prop declare hasMainContent: boolean;
  @prop declare onViewAll: () => void;

  render(): ReactNode {
    const { activity, loadingActivity, hasMainContent, onViewAll } = this;
    return (
      // Not "real-time telemetry": this list is a slice of one system-logs fetch made on dashboard
      // load, with no stream and no polling — the subtitle says so.
      <ListShell title={AdminI18n.t('dashboard.systemEvents')} subtitle={AdminI18n.t('dashboard.systemEventsHint')}
        actions={<Button variant={ButtonVariant.GHOST} onClick={onViewAll}>{AdminI18n.t('dashboard.viewAll')} <FrameworkIcons.ArrowRight size={13} /></Button>}>
        <div>
          <Slot name="admin.dashboard.main" />
          {!hasMainContent && activity.length > 0 ? activity.slice(0, 7).map((item) => (
            <ListRow
              key={item.id}
              icon={<IconBadge tone={item.level === 'ERROR' ? 'danger' : item.level === 'WARN' ? 'warning' : 'neutral'}><FrameworkIcons.Terminal size={14} /></IconBadge>}
              title={<span className="fc-ext-row__plain">{item.title}</span>}
              description={item.plugin && item.plugin !== 'system' ? (item.plugin.charAt(0).toUpperCase() + item.plugin.slice(1)) : AdminI18n.t('dashboard.system')}
              meta={new Date(item.timestamp).toLocaleTimeString(AdminI18n.locale, { hour: '2-digit', minute: '2-digit' })}
            />
          )) : null}
          {!hasMainContent && activity.length === 0 && !loadingActivity ? <EmptyState inline icon={<FrameworkIcons.Search size={16} />} title={AdminI18n.t('dashboard.noTelemetry')} /> : null}
        </div>
      </ListShell>
    );
  }
}
