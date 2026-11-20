import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { ReactNode } from 'react';
import { AdminLink } from '@/components/view/admin-link.client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { IconBadge } from '@/components/ui/view/icon-badge.client';
import { Button } from '@/components/ui/view/button.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Loader } from '@/components/ui/view/loader.client';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants/admin.constants';
import type { IAuthActivityEntry } from '@/app/users/[id]/security/interfaces/auth-activity-entry.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The account's latest sign-in and session events, read from the system log; the whole log is one link away. */
export class AuthActivityCard extends PureReactor {
  @prop declare activity: IAuthActivityEntry[];
  @prop declare activityLoading: boolean;
  @prop declare email: string;

  private tone(level: string): IconBadge['tone'] {
    if (level === 'ERROR') return 'danger';
    if (level === 'WARN') return 'warning';
    return 'neutral';
  }

  private renderRows(): ReactNode {
    if (this.activityLoading) return <Loader label={AdminI18n.t('users.loadingAuthActivity')} />;
    if (this.activity.length === 0) return <EmptyState inline icon={<FrameworkIcons.Activity size={16} />} title={AdminI18n.t('users.noRecentLoginSessionEvents')} />;
    return this.activity.slice(0, 12).map((entry, index) => {
      const timestamp = entry.timestamp || entry.createdAt;
      return (
        <ListRow
          key={entry.id || `${index}-${timestamp || ''}`}
          icon={<IconBadge tone={this.tone(String(entry.level || '').toUpperCase())}><FrameworkIcons.Activity size={14} /></IconBadge>}
          title={<span className="fc-ext-row__plain">{entry.message || ''}</span>}
          meta={timestamp ? new Date(timestamp).toLocaleString(AdminI18n.locale) : undefined}
        />
      );
    });
  }

  render(): ReactNode {
    return (
      <div id="auth-activity">
        <ListShell
          title={AdminI18n.t('users.loginSessionActivity')}
          actions={<AdminLink href={AdminConstants.ROUTES.ACTIVITY_FILTER({ mode: 'system', user: this.email })}><Button variant={ButtonVariant.GHOST}>{AdminI18n.t('users.openFullGlobalActivity')} <FrameworkIcons.ArrowRight size={13} /></Button></AdminLink>}
        >
          <div>{this.renderRows()}</div>
        </ListShell>
      </div>
    );
  }
}
