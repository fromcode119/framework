'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FrameworkIcons } from '@fromcode119/react';

export class PermissionsColumns {
  /** Build the permissions data-table column definitions for the given theme. */
  static build(theme: string): any[] {
    return [
    {
      header: 'Identifier',
      id: 'name',
      accessor: (p: any) => (
        <div className="flex flex-col gap-1">
          <span className={`font-mono font-semibold text-[11px] px-2.5 py-1 rounded-lg border shadow-sm w-fit ${
            theme === 'dark'
              ? 'bg-slate-950 border-slate-800 text-indigo-400'
              : 'bg-indigo-50 border-indigo-100 text-indigo-800'
          }`}>
            {p.name}
          </span>
          <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-tight pl-1">ID: {p.cid || 'SYS-AUTO'}</span>
        </div>
      )
    },
    {
      header: 'Domain',
      id: 'group',
      accessor: (p: any) => (
        <Badge variant={p.group === 'system' || p.group === 'core' ? 'amber' : 'blue'} className="font-semibold uppercase tracking-tight text-[10px] px-3 border-none flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${p.group === 'system' || p.group === 'core' ? 'bg-amber-500' : 'bg-blue-500'}`} />
          {(() => {
            const label = p.group || 'General';
            return label.charAt(0).toUpperCase() + label.slice(1);
          })()}
        </Badge>
      )
    },
    {
      header: 'Source',
      id: 'pluginSlug',
      accessor: (p: any) => (
        <div className="flex items-center gap-2">
           <div className={`h-6 w-6 rounded border flex items-center justify-center ${theme === 'dark' ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
              <FrameworkIcons.Plugins size={12} className="text-slate-400" />
           </div>
           <span className="text-[10px] font-semibold uppercase tracking-tight text-slate-500">
             {p.pluginSlug ? (p.pluginSlug.charAt(0).toUpperCase() + p.pluginSlug.slice(1)) : 'System'}
           </span>
        </div>
      )
    },
    {
      header: 'Security Risk',
      id: 'impact',
      accessor: (p: any) => (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 w-16 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${
              p.impact === 'Critical' ? 'w-full bg-rose-500' :
              p.impact === 'High' ? 'w-[75%] bg-amber-500' :
              p.impact === 'Medium' ? 'w-[40%] bg-indigo-500' : 'w-[20%] bg-emerald-500'
            }`} />
          </div>
          <span className={`text-[10px] font-semibold uppercase tracking-tight ${
            p.impact === 'Critical' ? 'text-rose-500' :
            p.impact === 'High' ? 'text-amber-500' :
            p.impact === 'Medium' ? 'text-indigo-500' : 'text-emerald-500'
          }`}>{p.impact || 'Normal'}</span>
        </div>
      )
    },
    {
      header: 'Definition',
      id: 'description',
      accessor: (p: any) => (
        <span className="text-sm font-semibold text-slate-500 leading-relaxed block max-w-sm">{p.description}</span>
      )
    }
    ];
  }
}
