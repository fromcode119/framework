import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Skeleton } from '@/components/ui/view/skeleton.client';
import { StateBadge } from '@/components/ui/view/state-badge.client';
import { Text } from '@/components/ui/view/text.client';
import { Button } from '@/components/ui/view/button.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { AdminLink } from '@/components/view/admin-link.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class RolesAuditSidebar extends PureReactor {
  @prop declare logs: any[];
  @prop declare health: any;
  @prop declare loading: boolean;
  /** Accepted for backward-compat and ignored — the look comes from the kit. */
  @prop declare theme: ThemeMode;

  private static tone(level: string): string {
    if (level === 'ERROR') return 'danger';
    return level === 'WARN' ? 'warning' : 'success';
  }

  private static owner(log: any): string {
    const slug = String(log.plugin_slug || '');
    return slug && slug !== 'system' ? slug.charAt(0).toUpperCase() + slug.slice(1) : AdminI18n.t('activity.system');
  }

  render(): ReactNode {
    const { logs, health, loading } = this;
    return (
      <div className="lg:col-span-12 xl:col-span-4 fc-columns__stack">
        <RecordCard title={AdminI18n.t('users.securityArchitecture')}>
          <Text muted>{AdminI18n.t('users.rolesDefineTheMaximumPrivilege')}</Text>
        </RecordCard>

        <ListShell
          title={AdminI18n.t('users.recentActivity')}
          actions={<Button variant={ButtonVariant.GHOST} as={AdminLink} href={AdminConstants.ROUTES.ACTIVITY}>{AdminI18n.t('users.viewLogs')}</Button>}
          foot={<Text size="xsmall" muted as="span">v{health?.version || '—'}{health?.maintenance ? ` · ${AdminI18n.t('users.maintenance')}` : ''}</Text>}
        >
          {loading ? (
            <div className="fc-list-band fc-stack"><Skeleton height={12} width="80%" /><Skeleton height={12} width="60%" /><Skeleton height={12} width="70%" /></div>
          ) : logs.length > 0 ? (
            <div>
              {logs.slice(0, 6).map((log, i) => (
                <ListRow key={log.id || i} title={log.message} description={RolesAuditSidebar.owner(log)} descriptionTitle={log.message}
                  actions={<StateBadge tone={RolesAuditSidebar.tone(log.level)}>{new Date(log.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</StateBadge>} />
              ))}
            </div>
          ) : (
            <EmptyState title={AdminI18n.t('users.noActivityLogged')} />
          )}
        </ListShell>
      </div>
    );
  }
}
