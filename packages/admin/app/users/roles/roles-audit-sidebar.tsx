'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';
import Link from 'next/link';
import type { RolesAuditSidebarProps } from './roles-audit-sidebar.interfaces';

export class RolesAuditSidebar extends React.Component<RolesAuditSidebarProps> {
  render(): React.ReactNode {
    const { logs, health, loading, theme } = this.props;
    return (
      <div className="lg:col-span-12 xl:col-span-4 space-y-8">
        <Card title="Security Architecture">
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight leading-none">Access Control</span>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                Roles define the maximum privilege boundary for all associated identities.
              </p>
            </div>

            <div className={`p-5 rounded-2.5xl border ${theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-indigo-50 border-indigo-100'}`}>
              <h4 className="text-[10px] font-bold uppercase tracking-tight text-indigo-500 mb-2">Live Enforcement</h4>
              <p className="text-[11px] font-bold text-indigo-600/70 dark:text-indigo-400/70 leading-relaxed">
                RBAC policies are synchronized across the cluster in real-time.
              </p>
            </div>
          </div>
        </Card>

        <Card className={`overflow-hidden transition-all duration-500 group/feed ${
          theme === 'dark'
            ? 'border-indigo-500/20 bg-indigo-500/[0.03]'
            : 'hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] transition-shadow'
        }`}>
          <div className="flex flex-col gap-6 mb-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-500 group-hover/feed:scale-110 group-hover/feed:rotate-3 ${
                  theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-600 text-white'
                }`}>
                  <FrameworkIcons.Search size={20} strokeWidth={2} />
                </div>
                <div>
                  <h3 className={`text-[10px] font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    System Audit Logs
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-1 opacity-70">Real-time Security Streams</p>
                </div>
              </div>

              <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 border shadow-sm ${
                theme === 'dark' ? 'bg-slate-950 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
              }`}>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-bold uppercase tracking-tight">Encrypted</span>
              </div>
            </div>
          </div>

          <div className="space-y-6 relative before:absolute before:left-[23.5px] before:top-3 before:bottom-3 before:w-[1px] before:bg-slate-100 dark:before:bg-slate-800/60">
            {loading ? (
               [1,2,3].map(i => (
                <div key={i} className="flex gap-6 relative animate-pulse">
                  <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
               ))
            ) : logs.length > 0 ? (
              logs.slice(0, 5).map((log, i) => (
                <div key={log.id || i} className="flex gap-6 relative group/item cursor-default">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-all duration-300 group-hover/item:scale-110 shadow-lg ${
                    theme === 'dark' ? 'bg-slate-950 border border-slate-800' : 'bg-white border border-slate-200'
                  }`}>
                    <div className={`h-2.5 w-2.5 rounded-full ${
                      log.level === 'ERROR' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' :
                      log.level === 'WARN' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' :
                      'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                    }`} />
                  </div>
                  <div className="flex flex-col justify-center">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold tracking-tight ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                        {log.message}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 gap-1 flex uppercase tracking-tight leading-none">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight flex items-center gap-1.5 mt-0.5 opacity-70">
                       {(() => {
                         const slug = log.plugin_slug || 'System';
                         return slug.charAt(0).toUpperCase() + slug.slice(1);
                       })()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 opacity-40 text-[10px] uppercase font-bold tracking-tight">No activity logged</div>
            )}
          </div>

          <div className={`mt-10 pt-8 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-tight text-slate-400">
                  API Version: {health?.version || 'unknown'}
                </span>
                <span className="text-[8px] font-bold text-slate-300 dark:text-slate-600 uppercase mt-0.5 tracking-tight">
                  {health?.maintenance ? 'Maintenance Mode: Active' : 'Maintenance Mode: Inactive'}
                </span>
              </div>
              <Link href={AdminConstants.ROUTES.ACTIVITY}>
                <Button variant="ghost" className="h-9 px-4 rounded-lg text-[9px] font-bold uppercase tracking-tight hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  View Logs
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }
}
