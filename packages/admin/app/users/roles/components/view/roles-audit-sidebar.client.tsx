import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { FieldSize } from '@/components/ui/enums/field-size.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { Card } from '@/components/ui/view/card.client';
import { Button } from '@/components/ui/view/button.client';
import { AdminConstants } from '@/lib/constants/admin.constants';
import Link from 'next/link';

export class RolesAuditSidebar extends PureReactor {
  @prop declare logs: any[];
  @prop declare health: any;
  @prop declare loading: boolean;
  @prop declare theme: ThemeMode;

  render(): ReactNode {
    const { logs, health, loading, theme } = this;
    const dark = theme === ThemeMode.DARK;
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
              [1, 2, 3].map(i => <div key={i} className="h-8 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />)
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
              <Button variant={ButtonVariant.GHOST} size={FieldSize.SM} className="text-[10px] text-slate-500">View logs</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }
}
