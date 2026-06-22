'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AdminConstants } from '@/lib/constants';
import Link from 'next/link';
import type { RolesAuditSidebarProps } from './roles-audit-sidebar.interfaces';

export class RolesAuditSidebar extends React.Component<RolesAuditSidebarProps> {
  render(): React.ReactNode {
    const { logs, health, loading, theme } = this.props;
    const dark = theme === 'dark';
    return (
      <div className="lg:col-span-12 xl:col-span-4 space-y-4">
        <Card title="Security Architecture">
          <p className="text-xs font-medium text-slate-500 leading-relaxed">
            Roles define the maximum privilege boundary for all associated identities. RBAC policies are enforced on every request.
          </p>
        </Card>

        <Card title="Recent Activity">
          <div className="space-y-0.5">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-8 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />)
            ) : logs.length > 0 ? (
              logs.slice(0, 6).map((log, i) => (
                <div key={log.id || i} className="flex items-start gap-2.5 py-1.5">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                    log.level === 'ERROR' ? 'bg-rose-500' : log.level === 'WARN' ? 'bg-amber-500' : 'bg-indigo-500'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-xs font-medium ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{log.message}</span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {(() => { const s = log.plugin_slug || 'System'; return s.charAt(0).toUpperCase() + s.slice(1); })()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">No activity logged</div>
            )}
          </div>

          <div className={`mt-3 flex items-center justify-between border-t pt-3 ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
            <span className="text-[10px] text-slate-400">v{health?.version || '—'}{health?.maintenance ? ' · maintenance' : ''}</span>
            <Link href={AdminConstants.ROUTES.ACTIVITY}>
              <Button variant="ghost" size="sm" className="text-[10px] text-slate-500">View logs</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }
}
