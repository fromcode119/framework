import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { ListShell } from '@/components/ui/view/list-shell.client';
import { ListRow } from '@/components/ui/view/list-row.client';
import { IconBadge } from '@/components/ui/view/icon-badge.client';
import { Badge } from '@/components/ui/view/badge.client';
import { Button } from '@/components/ui/view/button.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Loader } from '@/components/ui/view/loader.client';
import { FrameworkIcons } from '@fromcode119/react';
import { UserSecurityPageService } from '@/app/users/[id]/security/user-security-page-service';
import type { IUserSessionRecord } from '@/app/users/[id]/security/interfaces/user-session-record.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/** The devices this account is signed in on, one row each, each one revocable. */
export class DeviceSessionsCard extends PureReactor {
  @prop declare onRevokeOtherSessions: () => void;
  @prop declare onRevokeSession: (session: IUserSessionRecord) => void;
  @prop declare sessions: IUserSessionRecord[];
  @prop declare sessionsLoading: boolean;

  private meta(session: IUserSessionRecord): string {
    const parts = [
      session.ipAddress ? AdminI18n.t('users.ipAddress', { ip: session.ipAddress }) : '',
      session.expiresAt ? AdminI18n.t('users.expiresOn', { date: new Date(session.expiresAt).toLocaleString(AdminI18n.locale) }) : '',
    ];
    return parts.filter(Boolean).join(' · ');
  }

  private renderRows(): ReactNode {
    if (this.sessionsLoading) return <Loader label={AdminI18n.t('users.loadingSessions')} />;
    if (this.sessions.length === 0) return <EmptyState inline icon={<FrameworkIcons.Fingerprint size={16} />} title={AdminI18n.t('users.noActiveSessions')} />;
    return this.sessions.map((session) => (
      <ListRow
        key={String(session.id)}
        icon={<IconBadge tone={session.isCurrent ? 'success' : 'neutral'}><FrameworkIcons.Fingerprint size={14} /></IconBadge>}
        title={<span className="fc-ext-row__plain">{UserSecurityPageService.describeDevice(session.userAgent) || AdminI18n.t('users.unknownDevice')}</span>}
        badges={session.isCurrent ? <Badge variant={BadgeVariant.SUCCESS}>{AdminI18n.t('users.current')}</Badge> : null}
        description={this.meta(session) || undefined}
        descriptionTitle={session.userAgent}
        actions={<Button variant={ButtonVariant.OUTLINE} onClick={() => this.onRevokeSession(session)}>{AdminI18n.t('users.revoke')}</Button>}
      />
    ));
  }

  render(): ReactNode {
    const others = this.sessions.filter((session) => !session.isCurrent).length;
    return (
      <ListShell
        title={AdminI18n.t('users.deviceSessions')}
        count={this.sessionsLoading ? null : this.sessions.length}
        actions={others > 0 ? <Button variant={ButtonVariant.OUTLINE} onClick={this.onRevokeOtherSessions}>{AdminI18n.t('users.revokeOtherSessions')}</Button> : null}
      >
        <div>{this.renderRows()}</div>
      </ListShell>
    );
  }
}
