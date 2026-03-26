"use client";

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { FrameworkIcons } from '@/lib/icons';
import type { UserSessionRecord } from '../user-security-page.interfaces';

export default function DeviceSessionsCard({ isDark, sessions, sessionsLoading, onRevokeOtherSessions, onRevokeSession }: { isDark: boolean; onRevokeOtherSessions: () => Promise<void>; onRevokeSession: (sessionId: string) => Promise<void>; sessions: UserSessionRecord[]; sessionsLoading: boolean }) {
  return (
    <Card title="Device Sessions" icon={<FrameworkIcons.Activity size={18} className="text-indigo-500" />}>
      <div className="space-y-3">
        <div className="flex items-center justify-end"><Button variant="outline" className="font-bold text-xs tracking-tight uppercase" onClick={() => void onRevokeOtherSessions()}>Revoke Other Sessions</Button></div>
        {sessionsLoading ? <Loader label="Loading sessions..." /> : sessions.length === 0 ? <div className="text-xs font-bold uppercase tracking-tight text-slate-400 py-3">No active sessions.</div> : sessions.map((session) => <div key={String(session.id)} className={`p-3 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}><div className="flex items-start justify-between gap-3"><div className="space-y-1"><div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-700 dark:text-slate-200">{session.isCurrent ? 'Current Session' : 'Device Session'}</span>{session.isCurrent ? <span className="text-[10px] font-bold uppercase tracking-tight text-emerald-500">Current</span> : null}</div><p className="text-[11px] font-semibold text-slate-500 break-all">{String(session.userAgent || 'Unknown device')}</p><p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">IP: {String(session.ipAddress || 'unknown')} • Expires: {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : 'n/a'}</p></div><Button variant="outline" size="sm" className="text-[10px] font-bold uppercase tracking-tight" onClick={() => void onRevokeSession(String(session.id))}>Revoke</Button></div></div>)}
      </div>
    </Card>
  );
}
