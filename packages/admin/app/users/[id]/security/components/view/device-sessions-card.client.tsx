import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { Loader } from '@/components/ui/view/loader.client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IUserSessionRecord } from '@/app/users/[id]/security/interfaces/user-session-record.interface';
import { AdminClass } from '@/lib/admin-class';

export class DeviceSessionsCard extends PureReactor {
  @prop declare isDark: boolean;
  @prop declare onRevokeOtherSessions: () => Promise<void>;
  @prop declare onRevokeSession: (sessionId: string) => Promise<void>;
  @prop declare sessions: IUserSessionRecord[];
  @prop declare sessionsLoading: boolean;

  render(): ReactNode {
    const { isDark, sessions, sessionsLoading, onRevokeOtherSessions, onRevokeSession } = this;
    return (
      <Card title="Device Sessions" icon={<FrameworkIcons.Activity size={18} className="text-indigo-500" />}>
        <div className="space-y-3">
          <div className="flex items-center justify-end"><Button variant={ButtonVariant.OUTLINE} className="font-bold text-xs tracking-tight uppercase" onClick={() => void onRevokeOtherSessions()}>Revoke Other Sessions</Button></div>
          {sessionsLoading ? <Loader label="Loading sessions..." /> : sessions.length === 0 ? <div className="text-xs font-bold uppercase tracking-tight text-slate-400 py-3">No active sessions.</div> : sessions.map((session) => <div key={String(session.id)} className={`p-3 ${AdminClass.SURFACE} ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-3"><div className="space-y-1"><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-700 dark:text-slate-200">{session.isCurrent ? 'Current Session' : 'Device Session'}</span>{session.isCurrent ? <span className="text-[10px] font-bold uppercase tracking-tight text-emerald-500">Current</span> : null}</div><p className="text-[11px] font-semibold text-slate-500 break-all">{String(session.userAgent || 'Unknown device')}</p><p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">IP: {String(session.ipAddress || 'unknown')} • Expires: {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : 'n/a'}</p></div><Button variant={ButtonVariant.OUTLINE} size={FieldSize.SM} className="text-[10px] font-bold uppercase tracking-tight" onClick={() => void onRevokeSession(String(session.id))}>Revoke</Button></div></div>)}
        </div>
      </Card>
    );
  }
}
