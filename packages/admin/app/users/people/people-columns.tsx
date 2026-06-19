'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { Person } from './people-page.interfaces';

export function buildPeopleColumns(theme: string, displayName: (p: Person) => string): any[] {
  return [
    {
      header: 'Person', id: 'person',
      accessor: (p: Person) => (
        <div>
          <div className={`font-bold tracking-tight ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{displayName(p)}</div>
          <div className="text-[11px] font-bold tracking-tight text-slate-500 flex items-center gap-1 opacity-70">
            <FrameworkIcons.Mail size={12} /> {p.email || '—'}{p.phone ? ` · ${p.phone}` : ''}
          </div>
        </div>
      ),
    },
    {
      header: 'Login account', id: 'linked',
      accessor: (p: Person) => (p.userId != null && p.userId !== '')
        ? <span className="font-bold text-emerald-500 text-[11px] tracking-tight flex items-center gap-1"><FrameworkIcons.UserCheck size={14} /> Linked (#{p.userId})</span>
        : <span className="font-bold text-slate-400 text-[11px] tracking-tight">No account</span>,
    },
    {
      header: 'Added', id: 'createdAt',
      accessor: (p: Person) => (
        <div className="flex items-center gap-2 font-bold text-[11px] tracking-tight text-slate-500">
          <FrameworkIcons.Calendar size={14} className="opacity-50" />
          {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}
        </div>
      ),
    },
  ];
}
