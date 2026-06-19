import React from 'react';

export class ActivityColumnsFactory {
  static system(theme: string) {
    return [
      {
        header: 'Event',
        id: 'event',
        accessor: (row: any) => {
          const levelStyle = row.level === 'ERROR'
            ? (theme === 'dark' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-700')
            : row.level === 'WARN'
            ? (theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-700')
            : (theme === 'dark' ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700');

          return (
            <div className="flex flex-col gap-1">
              <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-semibold w-fit tracking-tighter ${levelStyle}`}>
                 {row.level}
              </span>
              <span className="text-[9px] font-semibold text-slate-400 tracking-wide pl-1">
                {String(row.id).includes('-') ? row.id.split('-')[0] : `LOG-${row.id}`}
              </span>
            </div>
          );
        }
      },
      {
        header: 'Actor',
        id: 'actor',
        accessor: (row: any) => {
          const actor = row.actor_id || row.context?.email || (row.message && row.message.includes('for ') ? row.message.split('for ')[1] : 'SYSTEM');
          return (
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-full flex items-center justify-center text-[10px] font-semibold border-2 ${
                theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}>
                {actor[0].toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-semibold text-slate-600 dark:text-white tracking-tight leading-none">{actor}</span>
                <span className="text-[10px] font-semibold text-slate-400 mt-1 tracking-tight">
                  {row.actor_id ? `ID: ${row.actor_id}` : (row.context?.userId ? `UID: ${row.context.userId}` : 'INTERNAL')}
                </span>
              </div>
            </div>
          );
        }
      },
      {
        header: 'Resource',
        id: 'target',
        accessor: (row: any) => (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500/60 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
            <span className="font-semibold text-[11px] text-slate-500 tracking-wide">{row.plugin_slug ? (row.plugin_slug.charAt(0).toUpperCase() + row.plugin_slug.slice(1)) : 'System'}</span>
          </div>
        )
      },
      {
        header: 'Timestamp',
        id: 'timestamp',
        accessor: (row: any) => (
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
               {new Date(row.timestamp || row.createdAt).toLocaleTimeString()}
            </span>
            <span className="text-[8px] font-semibold text-slate-400 tracking-wide mt-0.5 italic">
               {new Date(row.timestamp || row.createdAt).toLocaleDateString()}
            </span>
          </div>
        )
      },
      {
        header: 'Activity',
        id: 'details',
        accessor: (row: any) => (
          <span className="text-xs font-medium text-slate-500 leading-relaxed block max-w-sm">{row.message}</span>
        )
      }
    ];
  }

  static security(theme: string) {
    return [
      {
        header: 'Status',
        id: 'status',
        accessor: (row: any) => {
          const style = row.status === 'violation'
            ? (theme === 'dark' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-100 text-rose-700')
            : row.status === 'denied'
            ? (theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-700')
            : (theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700');

          return (
            <div className="flex flex-col gap-1">
              <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-semibold w-fit tracking-tighter ${style}`}>
                 {row.status}
              </span>
            </div>
          );
        }
      },
      {
        header: 'plugin',
        id: 'plugin',
        accessor: (row: any) => (
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 text-[10px] font-semibold">
               {row.plugin_slug ? row.plugin_slug[0].toUpperCase() : 'S'}
            </div>
            <span className="font-semibold text-[11px] text-slate-600 dark:text-slate-200 tracking-wide">{row.plugin_slug ? (row.plugin_slug.charAt(0).toUpperCase() + row.plugin_slug.slice(1)) : 'System'}</span>
          </div>
        )
      },
      {
        header: 'Action',
        id: 'action',
        accessor: (row: any) => (
          <div className="flex flex-col">
             <span className="text-xs font-semibold text-slate-700 dark:text-white tracking-tight">{row.action}</span>
             <span className="text-[10px] font-medium text-slate-400 mt-0.5">{row.resource}</span>
          </div>
        )
      },
      {
        header: 'Time',
        id: 'timestamp',
        accessor: (row: any) => (
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
               {new Date(row.createdAt).toLocaleTimeString()}
            </span>
            <span className="text-[8px] font-semibold text-slate-400 tracking-wide mt-0.5 italic">
               {new Date(row.createdAt).toLocaleDateString()}
            </span>
          </div>
        )
      }
    ];
  }
}
