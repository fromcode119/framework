import { ThemeMode } from '@fromcode119/core/client';
import { FrameworkIcons } from '@fromcode119/react';
import type { IPerson } from '@/app/users/people/interfaces/person.interface';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

export class PeopleColumns {
  static build(theme: ThemeMode, displayName: (p: IPerson) => string): any[] {
    return [
    {
      header: AdminI18n.t('users.person2'), id: 'person',
      accessor: (p: IPerson) => (
        <div>
          <div className={`font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-slate-200' : 'text-slate-900'}`}>{displayName(p)}</div>
          <div className="text-[11px] font-bold tracking-tight text-slate-500 flex items-center gap-1 opacity-70">
            <FrameworkIcons.Mail size={12} /> {p.email || '—'}{p.phone ? ` · ${p.phone}` : ''}
          </div>
        </div>
      ),
    },
    {
      header: AdminI18n.t('users.loginAccount'), id: 'linked',
      accessor: (p: IPerson) => (p.userId != null && p.userId !== '')
        ? <span className="font-bold text-emerald-500 text-[11px] tracking-tight flex items-center gap-1"><FrameworkIcons.UserCheck size={14} /> {AdminI18n.t('users.linkedToUser', { id: p.userId })}</span>
        : <span className="font-bold text-slate-400 text-[11px] tracking-tight">{AdminI18n.t('users.noAccount')}</span>,
    },
    {
      header: AdminI18n.t('users.added'), id: 'createdAt',
      accessor: (p: IPerson) => (
        <div className="flex items-center gap-2 font-bold text-[11px] tracking-tight text-slate-500">
          <FrameworkIcons.Calendar size={14} className="opacity-50" />
          {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
        </div>
      ),
    },
    ];
  }
}
