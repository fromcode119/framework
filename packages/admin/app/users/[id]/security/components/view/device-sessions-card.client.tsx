import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Loader } from '@/components/ui/view/loader.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IUserSessionRecord } from '@/app/users/[id]/security/interfaces/user-session-record.interface';
import { AdminClass } from '@/lib/admin-class';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class DeviceSessionsCard extends PureReactor {
  @prop declare isDark: boolean;
  @prop declare onRevokeOtherSessions: () => Promise<void>;
  @prop declare onRevokeSession: (sessionId: string) => Promise<void>;
  @prop declare sessions: IUserSessionRecord[];
  @prop declare sessionsLoading: boolean;

  render(): ReactNode {
    const { isDark, sessions, sessionsLoading, onRevokeOtherSessions, onRevokeSession } = this;
    return (
      <Card title={AdminI18n.t('users.deviceSessions')} icon={<FrameworkIcons.Activity size={18} className="text-indigo-500" />}>
        <div className="space-y-3">
          <div className="flex items-center justify-end"><Button variant={ButtonVariant.OUTLINE} className="font-bold text-xs tracking-tight uppercase" onClick={() => void onRevokeOtherSessions()}>{AdminI18n.t('users.revokeOtherSessions')}</Button></div>
          {sessionsLoading ? <Loader label={AdminI18n.t('users.loadingSessions')} /> : sessions.length === 0 ? <div className="text-xs font-bold uppercase tracking-tight text-slate-400 py-3">{AdminI18n.t('users.noActiveSessions')}</div> : sessions.map((session) => <div key={String(session.id)} className={`p-3 ${AdminClass.SURFACE} ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-3"><div className="space-y-1"><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-700 dark:text-slate-200">{session.isCurrent ? AdminI18n.t('users.currentSession') : AdminI18n.t('users.deviceSession')}</span>{session.isCurrent ? <span className="text-[10px] font-bold uppercase tracking-tight text-emerald-500">{AdminI18n.t('users.current')}</span> : null}</div><p className="text-[11px] font-semibold text-slate-500 break-all">{String(session.userAgent || AdminI18n.t('users.unknownDevice'))}</p><p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">{AdminI18n.t('users.ipAddress', { ip: String(session.ipAddress || AdminI18n.t('users.unknownValue')) })} • {AdminI18n.t('users.expiresOn', { date: session.expiresAt ? new Date(session.expiresAt).toLocaleString() : AdminI18n.t('users.notAvailable') })}</p></div><Button variant={ButtonVariant.OUTLINE} size={FieldSize.SM} className="text-[10px] font-bold uppercase tracking-tight" onClick={() => void onRevokeSession(String(session.id))}>{AdminI18n.t('users.revoke')}</Button></div></div>)}
        </div>
      </Card>
    );
  }
}
